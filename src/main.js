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
let lintHtmlFiles
let ignoredRulesWhenModified
let ignoredRulesWhenFixing
let disableWhenNoEslintConfig
let ignoreFixableRulesWhileTyping

// Internal variables
const idleCallbacks = new Set()

// Internal functions
const idsToIgnoredRules = ruleIds =>
  ruleIds.reduce((ids, id) => {
    // eslint-disable-next-line no-param-reassign
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

const validScope = editor => editor.getCursors().some(cursor =>
  cursor.getScopeDescriptor().getScopesArray().some(scope =>
    scopes.includes(scope)))

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

    /**
     * FIXME: Deprecated eslintRulesDir{String} option in favor of
     * eslintRulesDirs{Array<String>}. Remove in the next major release,
     * in v8.5.0, or after 2018-04.
     */
    const oldRulesdir = atom.config.get('linter-eslint.eslintRulesDir')
    if (oldRulesdir) {
      const rulesDirs = atom.config.get('linter-eslint.eslintRulesDirs')
      if (rulesDirs.length === 0) {
        atom.config.set('linter-eslint.eslintRulesDirs', [oldRulesdir])
      }
      atom.config.unset('linter-eslint.eslintRulesDir')
    }

    const embeddedScope = 'source.js.embedded.html'
    this.subscriptions.add(atom.config.observe(
      'linter-eslint.lintHtmlFiles',
      (value) => {
        lintHtmlFiles = value
        if (lintHtmlFiles) {
          scopes.push(embeddedScope)
        } else if (scopes.indexOf(embeddedScope) !== -1) {
          scopes.splice(scopes.indexOf(embeddedScope), 1)
        }
      }
    ))

    this.subscriptions.add(atom.config.observe(
      'linter-eslint.scopes',
      (value) => {
        // Remove any old scopes
        scopes.splice(0, scopes.length)
        // Add the current scopes
        Array.prototype.push.apply(scopes, value)
        // Ensure HTML linting still works if the setting is updated
        if (lintHtmlFiles && !scopes.includes(embeddedScope)) {
          scopes.push(embeddedScope)
        }
      }
    ))

    this.subscriptions.add(atom.workspace.observeTextEditors((editor) => {
      editor.onDidSave(async () => {
        if (validScope(editor) && atom.config.get('linter-eslint.fixOnSave')) {
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

    this.subscriptions.add(atom.config.observe(
      'linter-eslint.showRuleIdInMessage',
      (value) => { showRule = value }
    ))

    this.subscriptions.add(atom.config.observe(
      'linter-eslint.disableWhenNoEslintConfig',
      (value) => { disableWhenNoEslintConfig = value }
    ))

    this.subscriptions.add(atom.config.observe(
      'linter-eslint.rulesToSilenceWhileTyping',
      (ids) => { ignoredRulesWhenModified = idsToIgnoredRules(ids) }
    ))

    this.subscriptions.add(atom.config.observe(
      'linter-eslint.rulesToDisableWhileFixing',
      (ids) => { ignoredRulesWhenFixing = idsToIgnoredRules(ids) }
    ))

    this.subscriptions.add(atom.config.observe(
      'linter-eslint.ignoreFixableRulesWhileTyping',
      (value) => { ignoreFixableRulesWhileTyping = value }
    ))

    this.subscriptions.add(atom.contextMenu.add({
      'atom-text-editor:not(.mini), .overlayer': [{
        label: 'ESLint Fix',
        command: 'linter-eslint:fix-file',
        shouldDisplay: (evt) => {
          const activeEditor = atom.workspace.getActiveTextEditor()
          if (!activeEditor) {
            return false
          }
          // Black magic!
          // Compares the private component property of the active TextEditor
          //   against the components of the elements
          const evtIsActiveEditor = evt.path.some(elem =>
            // Atom v1.19.0+
            (elem.component && activeEditor.component &&
              elem.component === activeEditor.component))
          // Only show if it was the active editor and it is a valid scope
          return evtIsActiveEditor && validScope(activeEditor)
        }
      }]
    }))

    const initializeESLintWorker = () => {
      this.worker = new Task(require.resolve('./worker.js'))
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
      lintsOnChange: true,
      lint: async (textEditor) => {
        if (!atom.workspace.isTextEditor(textEditor)) {
          // If we somehow get fed an invalid TextEditor just immediately return
          return null
        }

        const filePath = textEditor.getPath()
        if (!filePath) {
          // The editor currently has no path, we can't report messages back to
          // Linter so just return null
          return null
        }

        if (filePath.includes('://')) {
          // If the path is a URL (Nuclide remote file) return a message
          // telling the user we are unable to work on remote files.
          return helpers.generateUserMessage(textEditor, {
            severity: 'warning',
            excerpt: 'Remote file open, linter-eslint is disabled for this file.',
          })
        }

        const text = textEditor.getText()

        if (!helpers) {
          helpers = require('./helpers')
        }

        let rules = {}
        if (textEditor.isModified() && Object.keys(ignoredRulesWhenModified).length > 0) {
          rules = ignoredRulesWhenModified
        }
        if (textEditor.isModified() && ignoreFixableRulesWhileTyping) {
          // Note that this list will only contain rules after the first lint job
          rules = idsToIgnoredRules(helpers.getFixableRules())
        }

        if (!this.worker) {
          await waitOnIdle()
        }

        let response
        try {
          response = await helpers.sendJob(this.worker, {
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
          return helpers.processJobResponse(response, textEditor, showRule, this.worker)
        } catch (error) {
          return helpers.handleError(textEditor, error)
        }
      }
    }
  },

  async fixJob(isSave = false) {
    const textEditor = atom.workspace.getActiveTextEditor()

    if (!textEditor || !atom.workspace.isTextEditor(textEditor)) {
      // Silently return if the TextEditor is invalid
      return
    }

    if (textEditor.isModified()) {
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
    } catch (err) {
      atom.notifications.addWarning(err.message)
    }
  },
}
