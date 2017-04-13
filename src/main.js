'use babel'

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
import { CompositeDisposable } from 'atom'

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

const waitOnIdle = () =>
  new Promise((resolve) => {
    // The worker is initialized during an idle time, since the queued idle
    // callbacks are done in order, waiting on a newly queued idle callback will
    // ensure that the worker has been initialized
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
    this.active = true
    this.worker = null
    const initializeWorker = () => {
      if (!helpers) {
        helpers = require('./helpers')
      }
      const { worker, subscription } = helpers.spawnWorker()
      this.worker = worker
      this.subscriptions.add(subscription)
      worker.onDidExit(() => {
        if (this.active) {
          helpers.showError('Worker died unexpectedly', 'Check your console for more ' +
          'info. A new worker will be spawned instantly.')
          setTimeout(initializeWorker, 1000)
        }
      })
    }

    this.subscriptions.add(
      atom.config.observe('linter-eslint.scopes', (value) => {
        // Remove any old scopes
        scopes.splice(0, scopes.length)
        // Add the current scopes
        Array.prototype.push.apply(scopes, value)
      })
    )

    const embeddedScope = 'source.js.embedded.html'
    this.subscriptions.add(
      atom.config.observe('linter-eslint.lintHtmlFiles', (lintHtmlFiles) => {
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
          if (this.worker === null) {
            await waitOnIdle()
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
          const filePath = editor.getPath()
          const projectPath = atom.project.relativizePath(filePath)[0]

          // Do not try to fix if linting should be disabled
          const fileDir = path.dirname(filePath)
          const configPath = workerHelpers.getConfigPath(fileDir)
          const noProjectConfig = (configPath === null || isConfigAtHomeRoot(configPath))
          if (noProjectConfig && disableWhenNoEslintConfig) return

          let rules = {}
          if (Object.keys(ignoredRulesWhenFixing).length > 0) {
            rules = ignoredRulesWhenFixing
          }

          // The fix replaces the file content and the cursor jumps automatically
          // to the beginning of the file, so save current cursor position
          const cursorPosition = editor.getCursorBufferPosition()
          this.worker.request('job', {
            type: 'fix',
            config: atom.config.get('linter-eslint'),
            rules,
            filePath,
            projectPath
          }).then(() => {
            // set cursor to the position before fix job
            editor.setCursorBufferPosition(cursorPosition)
          }).catch((err) => {
            atom.notifications.addWarning(err.message)
          })
        }
      })
    }))

    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'linter-eslint:debug': async () => {
        if (this.worker === null) {
          await waitOnIdle()
        }
        if (!helpers) {
          helpers = require('./helpers')
        }
        const debugString = await helpers.generateDebugString(this.worker)
        const notificationOptions = { detail: debugString, dismissable: true }
        atom.notifications.addInfo('linter-eslint debugging information', notificationOptions)
      }
    }))

    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'linter-eslint:fix-file': async () => {
        if (this.worker === null) {
          await waitOnIdle()
        }
        const textEditor = atom.workspace.getActiveTextEditor()
        const filePath = textEditor.getPath()
        const projectPath = atom.project.relativizePath(filePath)[0]

        if (!textEditor || textEditor.isModified()) {
          // Abort for invalid or unsaved text editors
          atom.notifications.addError('Linter-ESLint: Please save before fixing')
          return
        }

        let rules = {}
        if (textEditor.isModified() && Object.keys(ignoredRulesWhenFixing).length > 0) {
          rules = ignoredRulesWhenFixing
        }

        // The fix replaces the file content and the cursor jumps automatically
        // to the beginning of the file, so save current cursor position
        const cursorPosition = textEditor.getCursorBufferPosition()
        this.worker.request('job', {
          type: 'fix',
          config: atom.config.get('linter-eslint'),
          rules,
          filePath,
          projectPath
        }).then(response =>
          atom.notifications.addSuccess(response)
        ).then(() => {
          // set cursor to the position before fix job
          textEditor.setCursorBufferPosition(cursorPosition)
        }).catch((err) => {
          atom.notifications.addWarning(err.message)
        })
      }
    }))

    this.subscriptions.add(
      atom.config.observe('linter-eslint.showRuleIdInMessage', (value) => {
        showRule = value
      })
    )

    this.subscriptions.add(
      atom.config.observe('linter-eslint.disableWhenNoEslintConfig', (value) => {
        disableWhenNoEslintConfig = value
      })
    )

    this.subscriptions.add(atom.config.observe('linter-eslint.rulesToSilenceWhileTyping', (ids) => {
      ignoredRulesWhenModified = idsToIgnoredRules(ids)
    }))

    this.subscriptions.add(atom.config.observe('linter-eslint.rulesToDisableWhileFixing', (ids) => {
      ignoredRulesWhenFixing = idsToIgnoredRules(ids)
    }))

    // Initialize the worker during an idle time, with a maximum wait of 5 seconds
    window.requestIdleCallback(initializeWorker, { timeout: 5000 })
  },
  deactivate() {
    idleCallbacks.forEach(callbackID => window.cancelIdleCallback(callbackID))
    idleCallbacks.clear()
    this.active = false
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
          return Promise.resolve([])
        }
        const filePath = textEditor.getPath()

        let rules = {}
        if (textEditor.isModified() && Object.keys(ignoredRulesWhenModified).length > 0) {
          rules = ignoredRulesWhenModified
        }

        if (this.worker === null) {
          await waitOnIdle()
        }

        return this.worker.request('job', {
          type: 'lint',
          contents: text,
          config: atom.config.get('linter-eslint'),
          rules,
          filePath,
          projectPath: atom.project.relativizePath(filePath)[0] || ''
        }).then((response) => {
          if (textEditor.getText() !== text) {
            /*
               The editor text has been modified since the lint was triggered,
               as we can't be sure that the results will map properly back to
               the new contents, simply return `null` to tell the
               `provideLinter` consumer not to update the saved results.
             */
            return null
          }
          if (!helpers) {
            helpers = require('./helpers')
          }
          return helpers.processESLintMessages(response, textEditor, showRule, this.worker)
        })
      }
    }
  }
}
