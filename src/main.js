'use babel'

import Path from 'path'
import escapeHTML from 'escape-html'
import ruleURI from 'eslint-rule-documentation'

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
import { CompositeDisposable, Range } from 'atom'

import { spawnWorker, showError, idsToIgnoredRules, validatePoint } from './helpers'

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
      'linter-eslint:debug': () => {
        const textEditor = atom.workspace.getActiveTextEditor()
        const filePath = textEditor.getPath()
        // eslint-disable-next-line import/no-dynamic-require
        const linterEslintMeta = require(Path.join(atom.packages.resolvePackagePath('linter-eslint'), 'package.json'))
        const config = atom.config.get('linter-eslint')
        const configString = JSON.stringify(config, null, 2)
        const hoursSinceRestart = process.uptime() / 3600
        this.worker.request('job', {
          type: 'debug',
          config,
          filePath
        }).then((response) => {
          const detail = [
            `atom version: ${atom.getVersion()}`,
            `linter-eslint version: ${linterEslintMeta.version}`,
            // eslint-disable-next-line import/no-dynamic-require
            `eslint version: ${require(Path.join(response.path, 'package.json')).version}`,
            `hours since last atom restart: ${Math.round(hoursSinceRestart * 10) / 10}`,
            `platform: ${process.platform}`,
            `Using ${response.type} eslint from ${response.path}`,
            `linter-eslint configuration: ${configString}`
          ].join('\n')
          const notificationOptions = { detail, dismissable: true }
          atom.notifications.addInfo('linter-eslint debugging information', notificationOptions)
        }).catch((response) => {
          atom.notifications.addError(`${response}`)
        })
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
          return response.map(({
            message, line, severity, ruleId, column, fix, endLine, endColumn }
          ) => {
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
            const msgLine = line - 1
            try {
              if (typeof endColumn !== 'undefined' && typeof endLine !== 'undefined') {
                // Here we always want the column to be a number
                const msgCol = Math.max(0, column - 1)
                validatePoint(textEditor, msgLine, msgCol)
                validatePoint(textEditor, endLine - 1, endColumn - 1)
                range = [[msgLine, msgCol], [endLine - 1, endColumn - 1]]
              } else {
                // We want msgCol to remain undefined if it was initially so
                // `rangeFromLineNumber` will give us a range over the entire line
                const msgCol = typeof column !== 'undefined' ? column - 1 : column
                range = Helpers.rangeFromLineNumber(textEditor, msgLine, msgCol)
              }
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
