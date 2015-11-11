'use babel'

import {CompositeDisposable} from 'atom'

export default {
  config: {
    lintHtmlFiles: {
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
      lint: function(textEditor) {
        console.log(textEditor.getPath())
        return []
      }
    }
  }
}
