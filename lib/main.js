'use babel'

import Path from 'path'
import { CompositeDisposable } from 'atom'
import { spawnWorker } from './helpers'
import escapeHTML from 'escape-html'

export default {
  config: {
    lintHtmlFiles: {
      title: 'Lint HTML Files',
      description: 'You should also add `eslint-plugin-html` to your .eslintrc plugins',
      type: 'boolean',
      default: false
    },
    useGlobalEslint: {
      title: 'Use global ESLint installation',
      description: 'Make sure you have it in your $PATH',
      type: 'boolean',
      default: false
    },
    showRuleIdInMessage: {
      title: 'Show Rule ID in Messages',
      type: 'boolean',
      default: true
    },
    disableWhenNoEslintConfig: {
      title: 'Disable when no ESLint config is found (in package.json or .eslintrc)',
      type: 'boolean',
      default: true
    },
    eslintrcPath: {
      title: '.eslintrc Path',
      description: "It will only be used when there's no config file in project",
      type: 'string',
      default: ''
    },
    globalNodePath: {
      title: 'Global Node Installation Path',
      description: 'Write the value of `npm get prefix` here',
      type: 'string',
      default: ''
    },
    eslintRulesDir: {
      title: 'ESLint Rules Dir',
      description: 'Specify a directory for ESLint to load rules from',
      type: 'string',
      default: ''
    },
    disableEslintIgnore: {
      title: 'Disable using .eslintignore files',
      type: 'boolean',
      default: false
    },
    respawnWorkerAfter: {
      title: 'Wait this number of milliseconds before respawning a crashed ESLint worker.',
      type: 'integer',
      default: 5000,
      minimum: 1000
    }
  },
  activate() {
    require('atom-package-deps').install()

    this.subscriptions = new CompositeDisposable()
    this.active = true
    this.worker = null
    this.exitNotification = null
    this.scopes = ['source.js', 'source.jsx', 'source.js.jsx', 'source.babel', 'source.js-semantic']

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
    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'linter-eslint:fix-file': () => {
        const textEditor = atom.workspace.getActiveTextEditor()
        const filePath = textEditor.getPath()
        const fileDir = Path.dirname(filePath)

        if (!textEditor || textEditor.isModified()) {
          // Abort for invalid or unsaved text editors
          atom.notifications.addError('Linter-ESLint: Please save before fixing')
          return
        }

        this.worker.request('FIX', {
          fileDir,
          filePath,
          global: atom.config.get('linter-eslint.useGlobalEslint'),
          nodePath: atom.config.get('linter-eslint.globalNodePath'),
          configFile: atom.config.get('linter-eslint.eslintrcPath')
        }).then(function (response) {
          atom.notifications.addSuccess(response)
        }).catch(function (response) {
          atom.notifications.addWarning(response)
        })
      }
    }))

    const initializeWorker = () => {
      if (this.active) {
        const { child, worker, subscription } = spawnWorker()
        this.worker = worker
        this.subscriptions.add(subscription)

        child.on('exit-linter', shouldLive => {
          this.worker = null
          // Respawn if it crashed. See atom/electron#3446
          if (shouldLive) {
            let respawnAfter = atom.config.get('linter-eslint.respawnWorkerAfter')
            if (this.exitNotification) {
              this.exitNotification.dismiss()
            }
            this.exitNotification = atom.notifications.addWarning('[Linter-ESLint] Worker died unexpectedly',
              {
                detail: 'Check your console for more info. A new worker will be spawned in ' + respawnAfter + 'ms.',
                dismissable: false
              }
            )
            setTimeout(() =>
              initializeWorker()
            , respawnAfter)
          }
        })
      }
    }
    initializeWorker()
  },
  deactivate() {
    this.active = false
    if (this.exitNotification) {
      this.exitNotification.dismiss()
    }
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
        if (!this.worker) {
          return Promise.resolve([])
        }
        const text = textEditor.getText()
        if (text.length === 0) {
          return Promise.resolve([])
        }
        const filePath = textEditor.getPath()
        const fileDir = Path.dirname(filePath)
        const showRule = atom.config.get('linter-eslint.showRuleIdInMessage')

        return this.worker.request('JOB', {
          fileDir,
          filePath,
          contents: text,
          global: atom.config.get('linter-eslint.useGlobalEslint'),
          canDisable: atom.config.get('linter-eslint.disableWhenNoEslintConfig'),
          nodePath: atom.config.get('linter-eslint.globalNodePath'),
          rulesDir: atom.config.get('linter-eslint.eslintRulesDir'),
          configFile: atom.config.get('linter-eslint.eslintrcPath'),
          disableIgnores: atom.config.get('linter-eslint.disableEslintIgnore')
        }).then(function (response) {
          const ignoredMessage = 'File ignored because of your .eslintignore file. ' +
            'Use --no-ignore to override.'
          if (response.length === 1 && response[0].message === ignoredMessage) {
            return []
          }
          return response.map(function ({ message, line, severity, ruleId, column }) {
            const range = Helpers.rangeFromLineNumber(textEditor, line - 1)
            if (column) {
              range[0][1] = column - 1
            }
            if (column > range[1][1]) {
              range[1][1] = column - 1
            }
            const ret = {
              filePath,
              type: severity === 1 ? 'Warning' : 'Error',
              range
            }
            if (showRule) {
              ret.html = `<span class="badge badge-flexible">${ruleId || 'Fatal'}` +
                `</span> ${escapeHTML(message)}`
            } else {
              ret.text = message
            }
            return ret
          })
        })
      }
    }
  }
}
