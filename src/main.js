'use babel'

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
import { CompositeDisposable } from 'atom'
import { hasValidScope } from './validate/editor'

// Internal variables
const idleCallbacks = new Set()

// Dependencies
// NOTE: We are not directly requiring these in order to reduce the time it
// takes to require this file as that causes delays in Atom loading this package
let path
let helpers
let workerHelpers
let isConfigAtHomeRoot

const loadDeps = () => {
  if (!path) {
    path = require('path')
  }
  if (!helpers) {
    helpers = require('./helpers')
  }
  if (!workerHelpers) {
    workerHelpers = require('./worker-helpers')
  }
  if (!isConfigAtHomeRoot) {
    isConfigAtHomeRoot = require('./is-config-at-home-root')
  }
}

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
  const linterEslintLoadDependencies = loadDeps
  const linterEslintStartWorker = () => {
    loadDeps()
    helpers.startWorker()
  }

  if (!atom.inSpecMode()) {
    makeIdleCallback(linterEslintInstallPeerPackages)
    makeIdleCallback(linterEslintLoadDependencies)
    makeIdleCallback(linterEslintStartWorker)
  }
}

// Configuration
const scopes = []
let showRule
let lintHtmlFiles
let ignoredRulesWhenModified
let ignoredRulesWhenFixing
let disableWhenNoEslintConfig
let ignoreFixableRulesWhileTyping

// Internal functions
/**
 * Given an Array or iterable containing a list of Rule IDs, return an Object
 * to be sent to ESLint's configuration that disables those rules.
 * @param  {[iterable]} ruleIds Iterable containing ruleIds to ignore
 * @return {Object}             Object containing properties for each rule to ignore
 */
const idsToIgnoredRules = ruleIds =>
  Array.from(ruleIds).reduce(
    // 0 is the severity to turn off a rule
    (ids, id) => Object.assign(ids, { [id]: 0 })
    , {}
  )


module.exports = {
  activate() {
    this.subscriptions = new CompositeDisposable()

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
        if (hasValidScope(editor, scopes)
          && atom.config.get('linter-eslint.fixOnSave')
        ) {
          await this.fixJob(true)
        }
      })
    }))

    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'linter-eslint:debug': async () => {
        loadDeps()
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
      'linter-eslint.showRuleIdInMessage',
      (value) => { showRule = value }
    ))

    this.subscriptions.add(atom.config.observe(
      'linter-eslint.disableWhenNoEslintConfig',
      (value) => { disableWhenNoEslintConfig = value }
    ))

    this.subscriptions.add(atom.config.observe(
      'linter-eslint.rulesToSilenceWhileTyping',
      (ids) => { ignoredRulesWhenModified = ids }
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
          return evtIsActiveEditor && hasValidScope(activeEditor, scopes)
        }
      }]
    }))

    scheduleIdleTasks()
  },

  deactivate() {
    idleCallbacks.forEach(callbackID => window.cancelIdleCallback(callbackID))
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

        loadDeps()

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
            ignoredRulesWhenModified.forEach(ruleId => ignoredRules.add(ruleId))
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

    loadDeps()

    if (textEditor.isModified()) {
      // Abort for invalid or unsaved text editors
      const message = 'Linter-ESLint: Please save before fixing'
      atom.notifications.addError(message)
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
      atom.notifications.addWarning(err.message)
    }
  },
}
