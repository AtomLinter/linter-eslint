path = require 'path'

module.exports =
  config:
    eslintExecutablePath:
      type: 'string'
      default: path.join __dirname, '..', 'node_modules', 'eslint', 'bin'
    disableWhenNoEslintrcFileInPath:
      type: 'boolean'
      default: false
    eslintRulesDir:
      description: 'Relative to working directory'
      type: 'string'
      default: ''

  activate: ->
    console.log 'activate linter-eslint'
