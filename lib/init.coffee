path = require 'path'

module.exports =
  config:
    eslintRulesDir:
      type: 'string'
      default: ''
    eslintExtensions:
      type: 'array'
      default: ['js']
      items:
        type: 'string'

  activate: ->
    console.log 'activate linter-eslint'
