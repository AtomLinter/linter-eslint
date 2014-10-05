path = require 'path'

module.exports =
  config:
    eslintExecutablePath:
      type: 'string'
      default: path.join __dirname, '..', 'node_modules', 'eslint', 'bin'
    eslintRulesDir:
      type: 'string'
      default: ''
    defaultEslintConfig:
      type: 'string'
      default: ''

  activate: ->
    console.log 'activate linter-eslint'
