'use babel'

// NOTE: Requiring files adds significant time to package startup. To avoid this
// delay, we are *not* requiring at the top of this file. Use idleCallbacks to
// attempt to pre-cache requires for fast resolution if scheduler allows.

// Run idle tasks with all reasonable attempts to avoid blocking.
//
const linterEslintMakeIdleRunner = () => {
  const { requestIdleCallback, cancelIdleCallback } = window
  let id
  let tasks = []

  const linterEslintScheduleIdle = (deadline) => {
    // While time alotted by scheduler and work remaining
    while (deadline.timeRemaining() && tasks.length) {
      // Remove and run function from end of list.
      tasks.pop()()
    }
    // If work remains, request more time
    if (tasks.length) {
      id = requestIdleCallback(linterEslintScheduleIdle)
    }
  }

  return (requestedTasks = []) => {
    tasks = [...requestedTasks, ...tasks]
    id = requestIdleCallback(linterEslintScheduleIdle)
    return { dispose: () => cancelIdleCallback(id) }
  }
}

// // Simplified composite disposable
// //
const makeCompositeDisposable = () => {
  const disposables = new Set()
  return {
    add: (disposable) => {
      if (!(disposable.dispose instanceof Function)) {
        throw new Error('disposable must have dispose method')
      }
      disposables.add(disposable)
    },
    dispose: () => disposables.forEach(d => d.dispose())
  }
}


module.exports = {
  activate() {
    const {
      atomConfig,
      getMigrations,
      subscribe: configSubscribe
    } = require('./atom-config')

    const unlessSpec = f => () => !atom.inSpecMode() && f()

    const idleTasks = [
      // Migrate any outdated config settings
      () => getMigrations(),
      // Start the worker Task process
      unlessSpec(() => require('./worker-manager').task.start()),
      // Install peer packages
      unlessSpec(() => require('atom-package-deps').install('linter-eslint')),
      // Pre-cache dependency requires
      () => require('./validate/editor'),
      () => require('./linter-message'),
      () => require('./worker-manager'),
      () => require('./eslint-config-inspector'),
      () => require('./debug'),
      () => require('./rules'),
      () => require('path'),
    ]

    this.subscriptions = makeCompositeDisposable()

    // Put idle tasks on Atom's todo-list
    const requestIdles = linterEslintMakeIdleRunner()
    this.subscriptions.add(requestIdles(idleTasks))

    // Subscribe to Atom configuration settings
    this.subscriptions.add(...(configSubscribe()))

    // Subscribe to Save event so we can run fixOnSave
    this.subscriptions.add(atom.workspace.observeTextEditors((editor) => {
      editor.onDidSave(async () => {
        const { hasValidScope } = require('./validate/editor')

        const { fixOnSave, scopes } = atomConfig
        if (hasValidScope(editor, scopes) && fixOnSave) {
          await this.fixJob(true)
        }
      })
    }))

    // Subscribe to Debug command
    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'linter-eslint:debug': async () => {
        const { report } = require('./debug')

        const debugReport = await report()
        const notificationOptions = { detail: debugReport, dismissable: true }
        atom.notifications.addInfo('linter-eslint debugging information', notificationOptions)
      }
    }))

    // Subscribe to Fix File command
    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'linter-eslint:fix-file': async () => {
        await this.fixJob()
      }
    }))

    // Add context menu entry for Fix File
    this.subscriptions.add(atom.contextMenu.add({
      'atom-text-editor:not(.mini), .overlayer': [{
        label: 'ESLint Fix',
        command: 'linter-eslint:fix-file',
        shouldDisplay: (evt) => {
          const activeEditor = atom.workspace.getActiveTextEditor()
          if (!activeEditor) {
            return false
          }

          // Some scary voodoo black magic! Atom v1.19.0+
          // Compare private component property of active TextEditor to the
          // component props of elements to find matching <TextEditor> DOM Node.
          const evtIsActiveEditor = evt.path.some(elem =>
            (elem.component && activeEditor.component
              && elem.component === activeEditor.component))

          const { scopes } = atomConfig
          const { hasValidScope } = require('./validate/editor')

          // Only show if it was the active editor and it is a valid scope
          return evtIsActiveEditor && hasValidScope(activeEditor, scopes)
        }
      }]
    }))
  },

  deactivate() {
    const { task } = require('./worker-manager')
    if (task) {
      task.kill(true)
    }
    this.subscriptions.dispose()
  },

  provideLinter() {
    const {
      atomConfig,
      jobConfig
    } = require('./atom-config')
    const {
      fromException,
      processJobResponse,
      simple: simpleMessage
    } = require('./linter-message')
    const { sendJob } = require('./worker-manager')

    return {
      name: 'ESLint',
      grammarScopes: atomConfig.scopes,
      scope: 'file',
      lintsOnChange: true,
      lint: async (textEditor) => {
        // Cannot get valid lint  if we somehow got invalid TextEditor
        if (!atom.workspace.isTextEditor(textEditor)) return null

        const filePath = textEditor.getPath()
        // Cannot report back to Linter if the editor has no path.
        if (!filePath) return null

        // If the path is a URL (Nuclide remote file) return a message
        // telling the user we are unable to work on remote files.
        if (filePath.includes('://')) {
          return simpleMessage(textEditor, {
            severity: 'warning',
            excerpt: 'Remote file open, linter-eslint is disabled for this file.',
          })
        }

        const text = textEditor.getText()

        const ignored = textEditor.isModified()
          ? atomConfig.ignoredRulesWhileTyping
          : undefined

        try {
          const response = await sendJob({
            type: 'lint',
            contents: text,
            config: jobConfig(),
            rules: ignored,
            filePath,
            projectPath: atom.project.relativizePath(filePath)[0] || ''
          })
          return processJobResponse({
            text,
            response,
            textEditor,
            showRule: atomConfig.showRule
          })
        } catch (error) {
          return fromException(textEditor, error)
        }
      }
    }
  },

  async fixJob(isSave = false) {
    const {
      atomConfig,
      jobConfig
    } = require('./atom-config')
    const { isLintDisabled } = require('./eslint-config-inspector')
    const { dirname } = require('path')
    const { default: rules } = require('./rules')
    const { sendJob } = require('./worker-manager')

    const {
      disableWhenNoEslintConfig,
      ignoredRulesWhenFixing,
    } = atomConfig

    const textEditor = atom.workspace.getActiveTextEditor()

    // Silently return if the TextEditor is invalid
    if (!textEditor || !atom.workspace.isTextEditor(textEditor)) {
      return
    }

    // Abort for unsaved text editors
    if (textEditor.isModified()) {
      const message = 'Linter-ESLint: Please save before fixing'
      atom.notifications.addError(message)
      return
    }

    const filePath = textEditor.getPath()
    const fileDir = dirname(filePath)
    const projectPath = atom.project.relativizePath(filePath)[0]

    // Get the text from the editor, so we can use executeOnText
    const text = textEditor.getText()

    // Do not try to make fixes on an empty file
    if (text.length === 0) return

    // Do not try to fix if linting should be disabled
    if (isLintDisabled({ fileDir, disableWhenNoEslintConfig })) {
      return
    }

    try {
      const { messages, rulesDiff } = await sendJob({
        type: 'fix',
        config: jobConfig(),
        contents: text,
        rules: ignoredRulesWhenFixing,
        filePath,
        projectPath
      })

      rules().updateRules(rulesDiff)

      if (!isSave) {
        atom.notifications.addSuccess(messages)
      }
    } catch (err) {
      atom.notifications.addWarning(err.message)
    }
  },
}
