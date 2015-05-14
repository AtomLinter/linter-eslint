path = require 'path'

module.exports =
  config:
    eslintRulesDir:
      type: 'string'
      default: ''
    disableWhenNoEslintrcFileInPath:
      type: 'boolean'
      default: false
    useGlobalEslint:
      type: 'boolean'
      default: false

  activate: ->
    console.log 'activate linter-eslint'
