'use babel'

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
import { CompositeDisposable, Task } from 'atom'

// Dependencies
// NOTE: We are not directly requiring these in order to reduce the time it
// takes to require this file as that causes delays in Atom loading this package
let path
let helpers
let workerHelpers
let isConfigAtHomeRoot

// Configuration
const scopes = []
let showRule
let ignoredRulesWhenModified
let ignoredRulesWhenFixing
let disableWhenNoEslintConfig

// Internal variables
const idleCallbacks = new Set()

// Internal functions
const idsToIgnoredRules = ruleIds =>
  ruleIds.reduce((ids, id) => {
    ids[id] = 0 // 0 is the severity to turn off a rule
    return ids
  }, {})

// Worker still hasn't initialized, since the queued idle callbacks are
// done in order, waiting on a newly queued idle callback will ensure that
// the worker has been initialized
const waitOnIdle = async () =>
  new Promise((resolve) => {
    const callbackID = window.requestIdleCallback(() => {
      idleCallbacks.delete(callbackID)
      resolve()
    })
    idleCallbacks.add(callbackID)
  })

module.exports = {
  activate() {
    let callbackID
    const installLinterEslintDeps = () => {
      idleCallbacks.delete(callbackID)
      if (!atom.inSpecMode()) {
        require('atom-package-deps').install('linter-eslint')
      }
    }
    callbackID = window.requestIdleCallback(installLinterEslintDeps)
    idleCallbacks.add(callbackID)

    this.subscriptions = new CompositeDisposable()
    this.worker = null

    this.subscriptions.add(
      atom.config.observe('linter-eslint.scopes', (value) => {
        // Remove any old scopes
        scopes.splice(0, scopes.length)
        // Add the current scopes
        Array.prototype.push.apply(scopes, value)
      })
    )

    const embeddedScope = 'source.js.embedded.html'
    this.subscriptions.add(atom.config.observe('linter-eslint.lintHtmlFiles',
      (lintHtmlFiles) => {
        if (lintHtmlFiles) {
          scopes.push(embeddedScope)
        } else if (scopes.indexOf(embeddedScope) !== -1) {
          scopes.splice(scopes.indexOf(embeddedScope), 1)
        }
      })
    )

    this.subscriptions.add(atom.workspace.observeTextEditors((editor) => {
      editor.onDidSave(async () => {
        const validScope = editor.getCursors().some(cursor =>
          cursor.getScopeDescriptor().getScopesArray().some(scope =>
            scopes.includes(scope)))
        if (validScope && atom.config.get('linter-eslint.fixOnSave')) {
          await this.fixJob(true)
        }
      })
    }))

    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'linter-eslint:debug': async () => {
        if (!helpers) {
          helpers = require('./helpers')
        }
        if (!this.worker) {
          await waitOnIdle()
        }
        const debugString = await helpers.generateDebugString(this.worker)
        const notificationOptions = { detail: debugString, dismissable: true }
        atom.notifications.addInfo('linter-eslint debugging information', notificationOptions)
      }
    }))

    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'linter-eslint:fix-file': async () => {
        await this.fixJob()
      }
    }))

    this.subscriptions.add(atom.config.observe('linter-eslint.showRuleIdInMessage',
      (value) => {
        showRule = value
      })
    )

    this.subscriptions.add(atom.config.observe('linter-eslint.disableWhenNoEslintConfig',
      (value) => {
        disableWhenNoEslintConfig = value
      })
    )

    this.subscriptions.add(atom.config.observe('linter-eslint.rulesToSilenceWhileTyping', (ids) => {
      ignoredRulesWhenModified = idsToIgnoredRules(ids)
    }))

    this.subscriptions.add(atom.config.observe('linter-eslint.rulesToDisableWhileFixing', (ids) => {
      ignoredRulesWhenFixing = idsToIgnoredRules(ids)
    }))

    const initializeESLintWorker = () => {
      this.worker = new Task(require.resolve('./worker'))
    }
    // Initialize the worker during an idle time
    window.requestIdleCallback(initializeESLintWorker)
  },

  deactivate() {
    if (this.worker !== null) {
      this.worker.terminate()
      this.worker = null
    }
    idleCallbacks.forEach(callbackID => window.cancelIdleCallback(callbackID))
    idleCallbacks.clear()
    this.subscriptions.dispose()
  },

  provideLinter() {
    return {
      name: 'ESLint',
      grammarScopes: scopes,
      scope: 'file',
      lintOnFly: true,
      lint: async (textEditor) => {
        const text = textEditor.getText()
        if (text.length === 0) {
          return []
        }
        const filePath = textEditor.getPath()

        let rules = {}
        if (textEditor.isModified() && Object.keys(ignoredRulesWhenModified).length > 0) {
          rules = ignoredRulesWhenModified
        }

        if (!helpers) {
          helpers = require('./helpers')
        }

        if (!this.worker) {
          await waitOnIdle()
        }

        const response = await helpers.sendJob(this.worker, {
          type: 'lint',
          contents: text,
          config: atom.config.get('linter-eslint'),
          rules,
          filePath,
          projectPath: atom.project.relativizePath(filePath)[0] || ''
        })

        if (textEditor.getText() !== text) {
          /*
             The editor text has been modified since the lint was triggered,
             as we can't be sure that the results will map properly back to
             the new contents, simply return `null` to tell the
             `provideLinter` consumer not to update the saved results.
           */
          return null
        }
        return helpers.processESLintMessages(response, textEditor, showRule, this.worker)
      }
    }
  },

  async fixJob(isSave = false) {
    const textEditor = atom.workspace.getActiveTextEditor()

    if (!textEditor || textEditor.isModified()) {
      // Abort for invalid or unsaved text editors
      const message = 'Linter-ESLint: Please save before fixing'
      atom.notifications.addError(message)
    }

    if (!path) {
      path = require('path')
    }
    if (!isConfigAtHomeRoot) {
      isConfigAtHomeRoot = require('./is-config-at-home-root')
    }
    if (!workerHelpers) {
      workerHelpers = require('./worker-helpers')
    }

    const filePath = textEditor.getPath()
    const fileDir = path.dirname(filePath)
    const projectPath = atom.project.relativizePath(filePath)[0]

    // Get the text from the editor, so we can use executeOnText
    const text = textEditor.getText()
    // Do not try to make fixes on an empty file
    if (text.length === 0) {
      return
    }

    // Do not try to fix if linting should be disabled
    const configPath = workerHelpers.getConfigPath(fileDir)
    const noProjectConfig = (configPath === null || isConfigAtHomeRoot(configPath))
    if (noProjectConfig && disableWhenNoEslintConfig) {
      return
    }

    let rules = {}
    if (Object.keys(ignoredRulesWhenFixing).length > 0) {
      rules = ignoredRulesWhenFixing
    }

    // The fix replaces the file content and the cursor jumps automatically
    // to the beginning of the file, so save current cursor position
    const cursorPosition = textEditor.getCursorBufferPosition()
    if (!helpers) {
      helpers = require('./helpers')
    }
    if (!this.worker) {
      await waitOnIdle()
    }

    try {
      const response = await helpers.sendJob(this.worker, {
        type: 'fix',
        config: atom.config.get('linter-eslint'),
        contents: text,
        rules,
        filePath,
        projectPath
      })
      if (!isSave) {
        atom.notifications.addSuccess(response)
      }
      // Set cursor to the position before fix job
      textEditor.setCursorBufferPosition(cursorPosition)
    } catch (err) {
      atom.notifications.addWarning(err.message)
    }
  },
}
