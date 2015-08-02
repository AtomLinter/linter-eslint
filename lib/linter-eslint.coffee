path = require 'path'
helpers = require 'atom-linter'
{CompositeDisposable} = require 'atom'

module.exports =
  config:
    useGlobalEslint:
      type: 'boolean',
      default: false
      description: 'Use globally installed `eslint`'
    eslintPath:
      type: 'string'
      default: 'eslint'
      description: 'Path to your `eslint` bin'

  activate: ->
    unless atom.packages.getLoadedPackage 'linter'
      return atom.notifications.addError 'Linter should be installed first, `apm install linter`', dismissable: true
    @subscriptions = new CompositeDisposable()
    @subscriptions.add atom.config.observe('linter-eslint.useGlobalEslint', (value) =>
      @useGlobalEslint = value
    )
    @subscriptions.add atom.config.observe('linter-eslint.eslintPath', (value) =>
      @eslintPath = value
    )

  deactivate: ->
    @subscriptions.dispose()

  getEsLintPath: ->
    return @eslintPath if @useGlobalEslint
    return path.join(__dirname, '..', 'node_modules', 'eslint', 'bin', 'eslint.js')

  provideLinter: ->
    jsonFormat = require('eslint-json')
    provider =
      grammarScopes: ['source.js', 'source.js.jsx', 'source.babel', 'source.js-semantic']
      scope: 'file'
      lintOnFly: true
      lint: (TextEditor) =>
        filePath = TextEditor.getPath()
        fileDir = path.dirname(filePath)
        fileName = path.basename(filePath)

        return helpers.execNode(
          @getEsLintPath(),
          ['--format', jsonFormat, '--stdin-filename', fileName, '--no-color', '--stdin'],
          stdin: TextEditor.getText(), stream: 'stdout', cwd: fileDir
        ).then(JSON.parse).then((contents) ->
          return [] unless contents.results and contents.results.length
          return contents.results[0].messages.map((entry) ->
            return {
              type: if entry.severity is 1 then 'Warning' else 'Error'
              filePath,
              text: entry.message
              range: [[entry.line - 1, entry.column - 1], [entry.line - 1, entry.column]]
            }
          )
        )