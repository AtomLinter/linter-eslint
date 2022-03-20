// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
import { CompositeDisposable } from 'atom'
import { hasValidScope } from './validate/editor'
import * as helpers from './helpers'
import { migrateConfigOptions } from './migrate-config-options'

// Internal variables
const idleCallbacks = new Set()

const makeIdleCallback = (work) => {
  let callbackId
  const callBack = () => {
    idleCallbacks.delete(callbackId)
    work()
  }
  callbackId = window.requestIdleCallback(callBack)
  idleCallbacks.add(callbackId)
}

const scheduleIdleTasks = () => {
  const linterEslintInstallPeerPackages = () => {
    require('atom-package-deps').install('linter-eslint')
  }
  const linterEslintStartWorker = () => {
    helpers.startWorker()
  }

  if (!atom.inSpecMode()) {
    makeIdleCallback(linterEslintInstallPeerPackages)
    makeIdleCallback(linterEslintStartWorker)
  }
}

// Configuration
const scopes = []
let showRule
let lintHtmlFiles
let ignoredRulesWhenModified
let ignoredRulesWhenFixing
let ignoreFixableRulesWhileTyping

// Internal functions
/**
 * Given an Array or iterable containing a list of Rule IDs, return an Object
 * to be sent to ESLint's configuration that disables those rules.
 * @param  {[iterable]} ruleIds Iterable containing ruleIds to ignore
 * @return {Object}             Object containing properties for each rule to ignore
 */
const idsToIgnoredRules = (ruleIds) => (
  Array.from(ruleIds).reduce(
    // 0 is the severity to turn off a rule
    (ids, id) => Object.assign(ids, { [id]: 0 }),
    {}
  ))

module.exports = {
  activate() {
    this.subscriptions = new CompositeDisposable()

    migrateConfigOptions()

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
        if (hasValidScope(editor, scopes)
          && atom.config.get('linter-eslint.autofix.fixOnSave')
        ) {
          await this.fixJob(true)
        }
      })
    }))

    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'linter-eslint:debug': async () => {
        const debugString = await helpers.generateDebugString()
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
      'linter-eslint.advanced.showRuleIdInMessage',
      (value) => { showRule = value }
    ))

    this.subscriptions.add(atom.config.observe(
      'linter-eslint.disabling.rulesToSilenceWhileTyping',
      (ids) => { ignoredRulesWhenModified = ids }
    ))

    this.subscriptions.add(atom.config.observe(
      'linter-eslint.autofix.rulesToDisableWhileFixing',
      (ids) => { ignoredRulesWhenFixing = idsToIgnoredRules(ids) }
    ))

    this.subscriptions.add(atom.config.observe(
      'linter-eslint.autofix.ignoreFixableRulesWhileTyping',
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
          const evtIsActiveEditor = evt.path.some((elem) => (
            // Atom v1.19.0+
            elem.component && activeEditor.component
              && elem.component === activeEditor.component))
          // Only show if it was the active editor and it is a valid scope
          return evtIsActiveEditor && hasValidScope(activeEditor, scopes)
        }
      }]
    }))

    scheduleIdleTasks()
  },

  deactivate() {
    idleCallbacks.forEach((callbackID) => window.cancelIdleCallback(callbackID))
    idleCallbacks.clear()
    if (helpers) {
      // If the helpers module hasn't been loaded then there was no chance a
      // worker was started anyway.
      helpers.killWorker()
    }
    this.subscriptions.dispose()
  },

  provideLinter() {
    return {
      name: 'ESLint',
      grammarScopes: scopes,
      scope: 'file',
      lintsOnChange: true,
      /**
       * @param {import("atom").TextEditor} textEditor
       * @returns {Promise<import("atom/linter").Message[]>}
       */
      lint: async (textEditor) => {
        if (!atom.workspace.isTextEditor(textEditor)) {
          // If we somehow get fed an invalid TextEditor just immediately return
          return null
        }

        if (helpers.isIncompatibleEslint()) {
          // The project's version of ESLint doesn't work with this package. Once
          // this is detected, we won't try to send any jobs until the window is
          // reloaded.
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

        let rules = {}
        if (textEditor.isModified()) {
          if (ignoreFixableRulesWhileTyping) {
            // Note that the fixable rules will only have values after the first lint job
            const ignoredRules = new Set(helpers.rules.getFixableRules())
            ignoredRulesWhenModified.forEach((ruleId) => ignoredRules.add(ruleId))
            rules = idsToIgnoredRules(ignoredRules)
          } else {
            rules = idsToIgnoredRules(ignoredRulesWhenModified)
          }
        }

        try {
          const response = await helpers.sendJob({
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
          return helpers.processJobResponse(response, textEditor, showRule)
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

    if (helpers.isIncompatibleEslint()) {
      // The project's version of ESLint doesn't work with this package. Once
      // this is detected, we won't try to send any jobs until the window is
      // reloaded.
      return
    }

    if (textEditor.isModified()) {
      // Abort for invalid or unsaved text editors
      const message = 'Linter-ESLint: Please save before fixing'
      atom.notifications.addError(message)
    }

    const filePath = textEditor.getPath()
    const projectPath = atom.project.relativizePath(filePath)[0]

    // Get the text from the editor, so we can use executeOnText
    const text = textEditor.getText()
    // Do not try to make fixes on an empty file
    if (text.length === 0) {
      return
    }

    let rules = {}
    if (Object.keys(ignoredRulesWhenFixing).length > 0) {
      rules = ignoredRulesWhenFixing
    }

    try {
      const response = await helpers.sendJob({
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
      if (err.name === 'IncompatibleESLintError') {
        return
      }
      atom.notifications.addWarning(err.message)
    }
  },
}
