fs = require "fs"
path = require "path"
LinterNplintProvider = require './linter-nplint-provider'
packageDeps = require 'atom-package-deps'

module.exports =

  config:
    onTheFly:
      type: 'boolean'
      default: false
      description: "Lint on the fly"
    disableWhenNoNplintrcFileInPath:
      type: 'boolean'
      default: true
      description: 'Disable linter when no `.nplintrc` is found in project'
    showRuleIdInMessage:
      type: 'boolean'
      default: true
      description: 'Show the `nplint` rule before error'
    useGlobalNpLint:
      type: 'boolean'
      default: false
      description: 'Use globally installed `nplint`'
    globalNodePath:
      type: 'string'
      default: ''
      description: 'Run `$ npm config get prefix` to find it'

  activate: ->
    console.log 'activate linter-nplint' if atom.inDevMode()

    packageDeps.install 'linter-nplint'

  provideLinter: -> LinterNplintProvider
