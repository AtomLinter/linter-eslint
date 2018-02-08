'use babel'

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
import { CompositeDisposable } from 'atom'
import { hasValidScope } from './validate/editor'
import {
  atomConfig,
  jobConfig,
  getMigrations,
  subscribe as configSubscribe
} from './atom-config'

// Internal variables
const idleCallbacks = new Set()

// Dependencies
// NOTE: We are not directly requiring these in order to reduce the time it
// takes to require this file as that causes delays in Atom loading this package
let path
let worker
let configInspector
let debug
let linterMessage
let knownRules

const loadDeps = () => {
  if (!path) {
    path = require('path')
  }
  if (!worker) {
    worker = require('./worker-manager')
  }
  if (!configInspector) {
    configInspector = require('./eslint-config-inspector')
  }
  if (!debug) {
    debug = require('./debug')
  }
  if (!linterMessage) {
    linterMessage = require('./linter-message')
  }
  if (!knownRules) {
    knownRules = require('./rules').default
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
    worker.task.start()
  }

  if (!atom.inSpecMode()) {
    makeIdleCallback(linterEslintInstallPeerPackages)
    makeIdleCallback(linterEslintLoadDependencies)
    makeIdleCallback(linterEslintStartWorker)
  }
}

module.exports = {
  activate() {
    getMigrations().map(makeIdleCallback)
    this.subscriptions = new CompositeDisposable()
    this.subscriptions.add(...(configSubscribe()))

    this.subscriptions.add(atom.workspace.observeTextEditors((editor) => {
      editor.onDidSave(async () => {
        const { fixOnSave, scopes } = atomConfig
        if (hasValidScope(editor, scopes) && fixOnSave) {
          await this.fixJob(true)
        }
      })
    }))

    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'linter-eslint:debug': async () => {
        loadDeps()
        const debugString = await debug.report()
        const notificationOptions = { detail: debugString, dismissable: true }
        atom.notifications.addInfo('linter-eslint debugging information', notificationOptions)
      }
    }))

    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'linter-eslint:fix-file': async () => {
        await this.fixJob()
      }
    }))

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
            (elem.component && activeEditor.component
              && elem.component === activeEditor.component))
          // Only show if it was the active editor and it is a valid scope
          const { scopes } = atomConfig
          return evtIsActiveEditor && hasValidScope(activeEditor, scopes)
        }
      }]
    }))

    scheduleIdleTasks()
  },

  deactivate() {
    idleCallbacks.forEach(callbackID => window.cancelIdleCallback(callbackID))
    idleCallbacks.clear()
    if (worker) {
      // If the helpers module hasn't been loaded then there was no chance a
      // worker was started anyway.
      worker.task.kill()
    }
    this.subscriptions.dispose()
  },

  provideLinter() {
    return {
      name: 'ESLint',
      grammarScopes: atomConfig.scopes,
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
          return linterMessage.simple(textEditor, {
            severity: 'warning',
            excerpt: 'Remote file open, linter-eslint is disabled for this file.',
          })
        }

        const text = textEditor.getText()

        let rules = {}
        if (textEditor.isModified()) {
          const {
            ignoredRulesWhenModified,
            ignoreFixableRulesWhileTyping
          } = atomConfig

          rules = ignoreFixableRulesWhileTyping
            ? knownRules().getIgnoredRules(ignoredRulesWhenModified)
            : knownRules().toIgnored(ignoredRulesWhenModified)
        }

        try {
          const response = await worker.sendJob({
            type: 'lint',
            contents: text,
            config: jobConfig(),
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
          return linterMessage.processJobResponse({
            response,
            textEditor,
            showRule: atomConfig.showRule
          })
        } catch (error) {
          return linterMessage.fromException(textEditor, error)
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

    const { disableWhenNoEslintConfig, ignoredRulesWhenFixing } = atomConfig
    const { isLintDisabled } = configInspector

    // Do not try to fix if linting should be disabled
    if (isLintDisabled({ fileDir, disableWhenNoEslintConfig })) {
      return
    }

    try {
      const { messages, rulesDiff } = await worker.sendJob({
        type: 'fix',
        config: jobConfig(),
        contents: text,
        rules: ignoredRulesWhenFixing,
        filePath,
        projectPath
      })

      knownRules().updateRules(rulesDiff)

      if (!isSave) {
        atom.notifications.addSuccess(messages)
      }
    } catch (err) {
      atom.notifications.addWarning(err.message)
    }
  },
}
