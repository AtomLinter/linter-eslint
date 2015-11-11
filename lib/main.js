'use babel'

import Path from 'path'
import {CompositeDisposable} from 'atom'
import {spawnWorker} from './helpers'

export default {
  config: {
    lintHtmlFiles: {
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
    return {
      name: 'ESLint',
      grammarScopes: this.scopes,
      scope: 'file',
      lintOnFly: true,
      lint: textEditor => {
        const filePath = textEditor.getPath()
        const fileDir = Path.dirname(filePath)

        return this.worker.request('JOB', {
          cwd: fileDir,
          contents: textEditor.getText(),
          global: atom.config.get('linter-eslint.useGlobalEslint')
        }).then(function(response) {
          console.log(response)
          return []
        })
      }
    }
  }
}
