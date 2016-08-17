'use babel'

import escapeHTML from 'escape-html'
import ruleURI from 'eslint-rule-documentation'
// eslint-disable-next-line import/no-extraneous-dependencies
import { CompositeDisposable, Range } from 'atom'

import { spawnWorker, showError, idsToIgnoredRules } from './helpers'

// Configuration
const scopes = []
let showRule

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
        if (scopes.indexOf(editor.getGrammar().scopeName) !== -1 &&
            atom.config.get('linter-eslint.fixOnSave')) {
          this.worker.request('job', {
            type: 'fix',
            config: atom.config.get('linter-eslint'),
            filePath: editor.getPath()
          }).catch(response =>
            atom.notifications.addWarning(response)
          )
        }
      })
    }))

    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'linter-eslint:fix-file': () => {
        const textEditor = atom.workspace.getActiveTextEditor()
        const filePath = textEditor.getPath()

        if (!textEditor || textEditor.isModified()) {
          // Abort for invalid or unsaved text editors
          atom.notifications.addError('Linter-ESLint: Please save before fixing')
          return
        }

        this.worker.request('job', {
          type: 'fix',
          config: atom.config.get('linter-eslint'),
          filePath
        }).then(response =>
          atom.notifications.addSuccess(response)
        ).catch(response =>
          atom.notifications.addWarning(response)
        )
      }
    }))

    this.subscriptions.add(
      atom.config.observe('linter-eslint.showRuleIdInMessage', (value) => {
        showRule = value
      })
    )

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
    const Helpers = require('atom-linter')

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

        if (textEditor.isModified()) {
          rules = idsToIgnoredRules(atom.config.get('linter-eslint.silencedRuleIds'))
        }

        return this.worker.request('job', {
          contents: text,
          type: 'lint',
          config: atom.config.get('linter-eslint'),
          rules,
          filePath
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
          return response.map(({ message, line, severity, ruleId, column, fix }) => {
            const textBuffer = textEditor.getBuffer()
            let linterFix = null
            if (fix) {
              const fixRange = new Range(
                textBuffer.positionForCharacterIndex(fix.range[0]),
                textBuffer.positionForCharacterIndex(fix.range[1])
              )
              linterFix = {
                range: fixRange,
                newText: fix.text
              }
            }
            let range
            try {
              range = Helpers.rangeFromLineNumber(
                textEditor, line - 1, column ? column - 1 : column
              )
            } catch (err) {
              throw new Error(
                `Cannot mark location in editor for (${ruleId}) - (${message})` +
                ` at line (${line}) column (${column})`
              )
            }
            const ret = {
              filePath,
              type: severity === 1 ? 'Warning' : 'Error',
              range
            }

            if (showRule) {
              const elName = ruleId ? 'a' : 'span'
              const href = ruleId ? ` href=${ruleURI(ruleId).url}` : ''
              ret.html = `<${elName}${href} class="badge badge-flexible eslint">` +
                `${ruleId || 'Fatal'}</${elName}> ${escapeHTML(message)}`
            } else {
              ret.text = message
            }
            if (linterFix) {
              ret.fix = linterFix
            }

            return ret
          })
        })
      }
    }
  }
}
