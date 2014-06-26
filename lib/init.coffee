path = require 'path'

module.exports =
  configDefaults:
    eslintExecutablePath: path.join __dirname, '..', 'node_modules', 'eslint', 'bin'

  activate: ->
    console.log 'activate linter-eslint'
