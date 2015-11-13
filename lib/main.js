'use babel'

import Path from 'path'
import {CompositeDisposable} from 'atom'
import {spawnWorker} from './helpers'

export default {
  config: {
    lintHtmlFiles: {
      title: 'Lint HTML Files',
      description: 'You should also add `eslint-plugin-html` to you .eslintrc plugins',
      type: 'boolean',
      default: true
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
    disableWhenNoEslintrcFileInPath: {
      title: 'Disable when no .eslintrc is found',
      type: 'boolean',
      default: true
    }
  },
  activate: function() {
    require('atom-package-deps').install('linter-eslint')

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

    setTimeout(() => {
      if (this.active) {
        const {worker, subscription} = spawnWorker()
        this.worker = worker
        this.subscriptions.add(subscription)
      }
    }, 3 * 1000)
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
        const filePath = textEditor.getPath()
        const fileDir = Path.dirname(filePath)
        const showRule = atom.config.get('linter-eslint.showRuleIdInMessage')

        if (this.worker === null) {
          return []
        }

        return this.worker.request('JOB', {
          fileDir: fileDir,
          filePath: filePath,
          contents: textEditor.getText(),
          global: atom.config.get('linter-eslint.useGlobalEslint'),
          canDisable: atom.config.get('linter-eslint.disableWhenNoEslintrcFileInPath')
        }).then(function(response) {
          return response.map(function({message, line, severity, ruleId, column}){
            const range = Helpers.rangeFromLineNumber(textEditor, line - 1)
            if (column) {
              range[0][1] = column - 1
            }
            const ret = {
              filePath: filePath,
              type: severity === 1 ? 'Warning' : 'Error',
              range: range
            }
            if (showRule) {
              ret.html = `<span class="badge badge-flexible">${ruleId || 'Fatal'}</span> ${message}`
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
