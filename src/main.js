'use babel'

import escapeHTML from 'escape-html'
import ruleURI from 'eslint-rule-documentation'

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
import { CompositeDisposable, Range } from 'atom'

import {
  spawnWorker, showError, idsToIgnoredRules, validatePoint,
  getDebugInfo, generateDebugString
} from './helpers'

// Configuration
const scopes = []
let showRule
let ignoredRulesWhenModified

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
          const filePath = editor.getPath()
          const projectPath = atom.project.relativizePath(filePath)[0]

          this.worker.request('job', {
            type: 'fix',
            config: atom.config.get('linter-eslint'),
            filePath,
            projectPath
          }).catch(response =>
            atom.notifications.addWarning(response)
          )
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

        this.worker.request('job', {
          type: 'fix',
          config: atom.config.get('linter-eslint'),
          filePath,
          projectPath
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

    this.subscriptions.add(atom.config.observe('linter-eslint.rulesToSilenceWhileTyping', (ids) => {
      ignoredRulesWhenModified = idsToIgnoredRules(ids)
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
          const messagePromises = response.map(async ({
            message, line, severity, ruleId, column, fix, endLine, endColumn
          }) => {
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
            const msgLine = line - 1
            let msgCol
            let msgEndLine
            let msgEndCol
            let eslintFullRange = false
            if (typeof endColumn !== 'undefined' && typeof endLine !== 'undefined') {
              eslintFullRange = true
              // Here we always want the column to be a number
              msgCol = Math.max(0, column - 1)
              msgEndLine = endLine - 1
              msgEndCol = endColumn - 1
            } else {
              // We want msgCol to remain undefined if it was initially so
              // `rangeFromLineNumber` will give us a range over the entire line
              msgCol = typeof column !== 'undefined' ? column - 1 : column
            }

            let ret
            let range
            try {
              if (eslintFullRange) {
                validatePoint(textEditor, msgLine, msgCol)
                validatePoint(textEditor, msgEndLine, msgEndCol)
                range = [[msgLine, msgCol], [msgEndLine, msgEndCol]]
              } else {
                range = Helpers.rangeFromLineNumber(textEditor, msgLine, msgCol)
              }
              ret = {
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
            } catch (err) {
              let errMsgRange = `${msgLine + 1}:${msgCol}`
              if (eslintFullRange) {
                errMsgRange += ` - ${msgEndLine + 1}:${msgEndCol + 1}`
              }
              const rangeText = `Requested ${eslintFullRange ? 'start point' : 'range'}: ${errMsgRange}`
              const issueURL = 'https://github.com/AtomLinter/linter-eslint/issues/new'
              const titleText = `Invalid position given by '${ruleId}'`
              const title = encodeURIComponent(titleText)
              const body = encodeURIComponent([
                'ESLint returned a point that did not exist in the document being edited.',
                `Rule: ${ruleId}`,
                rangeText,
                '', '',
                '<!-- If at all possible, please include code to reproduce this issue! -->',
                '', '',
                'Debug information:',
                '```json',
                JSON.stringify(await getDebugInfo(), null, 2),
                '```'
              ].join('\n'))
              const newIssueURL = `${issueURL}?title=${title}&body=${body}`
              ret = {
                type: 'Error',
                severity: 'error',
                html: `${escapeHTML(titleText)}. See the trace for details. ` +
                  `<a href="${newIssueURL}">Report this!</a>`,
                filePath,
                range: Helpers.rangeFromLineNumber(textEditor, 0),
                trace: [
                  {
                    type: 'Trace',
                    text: `Original message: ${ruleId} - ${message}`,
                    filePath,
                    severity: 'info',
                  },
                  {
                    type: 'Trace',
                    text: rangeText,
                    filePath,
                    severity: 'info',
                  },
                ]
              }
            }

            return ret
          })

          return Promise.all(messagePromises).then(messages => messages)
        })
      }
    }
  }
}
