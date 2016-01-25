'use babel'

import { CompositeDisposable, Range } from 'atom'
import { spawnWorker, showError } from './helpers'
import escapeHTML from 'escape-html'

module.exports = {
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
    disableFSCache: {
      title: 'Disable FileSystem Cache',
      description: 'Paths of node_modules, .eslintignore and others are cached',
      type: 'boolean',
      default: false
    }
  },
  activate() {
    require('atom-package-deps').install()

    this.subscriptions = new CompositeDisposable()
    this.active = true
    this.worker = null
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
              ret.html = '<span class="badge badge-flexible">' +
                `${ruleId || 'Fatal'}</span>${escapeHTML(message)}`
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
