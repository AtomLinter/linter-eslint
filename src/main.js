'use babel'

import Path from 'path'
// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
import { CompositeDisposable, } from 'atom'

import {
  spawnWorker, showError, idsToIgnoredRules, processESLintMessages,
  generateDebugString,
} from './helpers'
import { getConfigPath } from './worker-helpers'
import { isConfigAtHomeRoot } from './is-config-at-home-root'

// Configuration
const scopes = []
let showRule
let ignoredRulesWhenModified
let ignoredRulesWhenFixing
let disableWhenNoEslintConfig

module.exports = {
  activate() {
    require('atom-package-deps').install()

    this.subscriptions = new CompositeDisposable()
    this.active = true
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
      editor.onDidSave(() => {
        const validScope = editor.getCursors().some(cursor =>
          cursor.getScopeDescriptor().getScopesArray().some(scope =>
            scopes.includes(scope)))
        if (validScope && atom.config.get('linter-eslint.fixOnSave')) {
          const filePath = editor.getPath()
          const projectPath = atom.project.relativizePath(filePath)[0]

          // Do not try to fix if linting should be disabled
          const fileDir = Path.dirname(filePath)
          const configPath = getConfigPath(fileDir)
          const noProjectConfig = (configPath === null || isConfigAtHomeRoot(configPath))
          if (noProjectConfig && disableWhenNoEslintConfig) return

          let rules = {}
          if (Object.keys(ignoredRulesWhenFixing).length > 0) {
            rules = ignoredRulesWhenFixing
          }

          this.worker.request('job', {
            type: 'fix',
            config: atom.config.get('linter-eslint'),
            rules,
            filePath,
            projectPath
          }).catch((err) => {
            atom.notifications.addWarning(err.message)
          })
        }
      })
    }))

    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'linter-eslint:debug': async () => {
        const debugString = await generateDebugString(this.worker)
        const notificationOptions = { detail: debugString, dismissable: true }
        atom.notifications.addInfo('linter-eslint debugging information', notificationOptions)
      }
    }))

    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'linter-eslint:fix-file': () => {
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

        this.worker.request('job', {
          type: 'fix',
          config: atom.config.get('linter-eslint'),
          rules,
          filePath,
          projectPath
        }).then(response =>
          atom.notifications.addSuccess(response)
        ).catch((err) => {
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

    const initializeWorker = () => {
      const { worker, subscription } = spawnWorker()
      this.worker = worker
      this.subscriptions.add(subscription)
      worker.onDidExit(() => {
        if (this.active) {
          showError('Worker died unexpectedly', 'Check your console for more ' +
          'info. A new worker will be spawned instantly.')
          setTimeout(initializeWorker, 1000)
        }
      })
    }
    initializeWorker()
  },
  deactivate() {
    this.active = false
    this.subscriptions.dispose()
  },
  provideLinter() {
    return {
      name: 'ESLint',
      grammarScopes: scopes,
      scope: 'file',
      lintOnFly: true,
      lint: (textEditor) => {
        const text = textEditor.getText()
        if (text.length === 0) {
          return Promise.resolve([])
        }
        const filePath = textEditor.getPath()

        let rules = {}
        if (textEditor.isModified() && Object.keys(ignoredRulesWhenModified).length > 0) {
          rules = ignoredRulesWhenModified
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
          return processESLintMessages(response, textEditor, showRule, this.worker)
        })
      }
    }
  }
}
