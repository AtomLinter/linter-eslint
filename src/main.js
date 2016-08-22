'use babel'

import { CompositeDisposable, Range } from 'atom'
import { spawnWorker, showError } from './helpers'
import escapeHTML from 'escape-html'
import ruleURI from 'eslint-rule-documentation'

module.exports = {
  activate() {
    require('atom-package-deps').install()

    this.subscriptions = new CompositeDisposable()
    this.active = true
    this.worker = null
    this.scopes = []

    this.subscriptions.add(atom.config.observe('linter-eslint.scopes', scopes => {
      // Remove any old scopes
      this.scopes.splice(0, this.scopes.length)
      // Add the current scopes
      Array.prototype.push.apply(this.scopes, scopes)
    }))
    const embeddedScope = 'source.js.embedded.html'
    this.subscriptions.add(atom.config.observe('linter-eslint.lintHtmlFiles', lintHtmlFiles => {
      if (lintHtmlFiles) {
        this.scopes.push(embeddedScope)
      } else {
        if (this.scopes.indexOf(embeddedScope) !== -1) {
          this.scopes.splice(this.scopes.indexOf(embeddedScope), 1)
        }
      }
    }))
    this.subscriptions.add(atom.workspace.observeTextEditors((editor) => {
      editor.onDidSave(() => {
        if (this.scopes.indexOf(editor.getGrammar().scopeName) !== -1 &&
            atom.config.get('linter-eslint.fixOnSave')) {
          this.worker.request('job', {
            type: 'fix',
            config: atom.config.get('linter-eslint'),
            filePath: editor.getPath()
          }).catch((response) =>
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
        }).then((response) =>
          atom.notifications.addSuccess(response)
        ).catch((response) =>
          atom.notifications.addWarning(response)
        )
      }
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
    const Helpers = require('atom-linter')
    return {
      name: 'ESLint',
      grammarScopes: this.scopes,
      scope: 'file',
      lintOnFly: true,
      lint: textEditor => {
        const text = textEditor.getText()
        if (text.length === 0) {
          return Promise.resolve([])
        }
        const filePath = textEditor.getPath()
        const showRule = atom.config.get('linter-eslint.showRuleIdInMessage')

        return this.worker.request('job', {
          contents: text,
          type: 'lint',
          config: atom.config.get('linter-eslint'),
          filePath
        }).then((response) =>
          response.map(({ message, line, severity, ruleId, column, fix }) => {
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
            const range = Helpers.rangeFromLineNumber(
              textEditor, line - 1, column ? column - 1 : column
            )
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
        )
      }
    }
  }
}
