'use babel'

import Path from 'path'
import {CompositeDisposable} from 'atom'
import {spawnWorker} from './helpers'

export default {
  config: {
    lintHtmlFiles: {
      title: 'Lint HTML Files',
      type: 'boolean',
      default: true
    },
    useGlobalEslint: {
      title: 'Use global ESLint installation',
      description: 'Make sure you have it in your $PATH',
      type: 'boolean',
      default: true
    }
  },
  activate: function() {
    require('atom-package-deps').install('linter-eslint')

    this.subscriptions = new CompositeDisposable()
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

    const {worker, subscription} = spawnWorker()
    this.worker = worker
    this.subscriptions.add(subscription)
  },
  deactivate: function() {
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

        return this.worker.request('JOB', {
          fileDir: fileDir,
          filePath: filePath,
          contents: textEditor.getText(),
          global: atom.config.get('linter-eslint.useGlobalEslint')
        }).then(function(response) {
          return response.map(function({message, line, severity, ruleId, column}){
            const range = Helpers.rangeFromLineNumber(textEditor, line - 1)
            if (column) {
              range[0][1] = column - 1
            }
            return {
              filePath: filePath,
              text: message,
              type: severity === 1 ? 'Warning' : 'Error',
              range: range
            }
          })
        })
      }
    }
  }
}
