'use babel'

import Path from 'path'
import {CompositeDisposable} from 'atom'
import {spawnWorker} from './helpers'
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
    }
  },
  activate: function() {
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
        const fileDir = Path.dirname(filePath)

        if (!textEditor || textEditor.isModified()) {
          // Abort for invalid or unsaved text editors
          atom.notifications.addError('Linter-ESLint: Please save before fixing')
          return
        }

        if (this.worker === null) {
          // Abort if worker is not yet ready
          atom.notifications.addError('Linter-ESLint: Not ready, please try again')
          return
        }

        this.worker.request('FIX', {
          fileDir: fileDir,
          filePath: filePath,
          global: atom.config.get('linter-eslint.useGlobalEslint'),
          nodePath: atom.config.get('linter-eslint.globalNodePath'),
          configFile: atom.config.get('linter-eslint.eslintrcPath')
        }).then(function(response) {
          atom.notifications.addSuccess(response)
        }).catch(function(response) {
          atom.notifications.addWarning(response)
        })
      }
    }))

    // Reason: I (steelbrain) have observed that if we spawn a
    // process while atom is starting up, it can increase startup
    // time by several seconds, But if we do this after 5 seconds,
    // we barely feel a thing.
    const initializeWorker = () => {
      if (this.active) {
        const {child, worker, subscription} = spawnWorker()
        this.worker = worker
        this.subscriptions.add(subscription)
        child.on('exit-linter', shouldLive => {
          this.worker = null
          // Respawn if it crashed. See atom/electron#3446
          if (shouldLive) {
            initializeWorker()
          }
        })
      }
    }
    setTimeout(initializeWorker, 5 * 1000)
  },
  deactivate: function() {
    this.active = false
    this.subscriptions.dispose()
  },
  provideLinter: function() {
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
        const fileDir = Path.dirname(filePath)
        const showRule = atom.config.get('linter-eslint.showRuleIdInMessage')

        if (this.worker === null) {
          return Promise.resolve([{
            filePath: filePath,
            type: 'Info',
            text: 'Worker initialization is delayed. Please try saving or typing to begin linting.',
            range: Helpers.rangeFromLineNumber(textEditor, 0)
          }])
        }

        return this.worker.request('JOB', {
          fileDir: fileDir,
          filePath: filePath,
          contents: text,
          global: atom.config.get('linter-eslint.useGlobalEslint'),
          canDisable: atom.config.get('linter-eslint.disableWhenNoEslintConfig'),
          nodePath: atom.config.get('linter-eslint.globalNodePath'),
          rulesDir: atom.config.get('linter-eslint.eslintRulesDir'),
          configFile: atom.config.get('linter-eslint.eslintrcPath'),
          disableIgnores: atom.config.get('linter-eslint.disableEslintIgnore')
        }).then(function(response) {
          if (response.length === 1 && response[0].message === 'File ignored because of your .eslintignore file. Use --no-ignore to override.') {
            return []
          }
          return response.map(function({message, line, severity, ruleId, column}) {
            const range = Helpers.rangeFromLineNumber(textEditor, line - 1)
            if (column) {
              range[0][1] = column - 1
            }
            if (column > range[1][1]) {
              range[1][1] = column - 1
            }
            const ret = {
              filePath: filePath,
              type: severity === 1 ? 'Warning' : 'Error',
              range: range
            }
            if (showRule) {
              ret.html = `<span class="badge badge-flexible">${ruleId || 'Fatal'}</span> ${escapeHTML(message)}`
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
