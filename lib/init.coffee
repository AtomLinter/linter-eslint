path = require 'path'

module.exports =
  config:
    eslintRulesDir:
      type: 'string'
      default: ''

  activate: ->
    console.log 'activate linter-eslint'
