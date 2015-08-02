path = require 'path'
{execNode} = require 'atom-linter'
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
    showRuleIdInMessage:
      type: 'boolean'
      default: true
      description: 'Show the `eslint` rule before error'

  activate: ->
    unless atom.packages.isPackageActive 'linter'
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
    provider =
      grammarScopes: ['source.js', 'source.js.jsx', 'source.babel', 'source.js-semantic']
      scope: 'file'
      lintOnFly: true
      lint: (TextEditor) =>
        filePath = TextEditor.getPath()

        # Add showRuleId option
        showRuleId = atom.config.get 'linter-eslint.showRuleIdInMessage'
        return execNode(@getEsLintPath())

        ###
        try
          results = []
          allowUnsafeNewFunction ->
            results = linter
              .verify TextEditor.getText(), config, filePath
              .map ({message, line, severity, ruleId}) ->

                # Calculate range to make the error whole line
                # without the indentation at begining of line
                indentLevel = TextEditor.indentationForBufferRow line - 1
                startCol = TextEditor.getTabLength() * indentLevel
                endCol = TextEditor.getBuffer().lineLengthForRow line - 1
                range = [[line - 1, startCol], [line - 1, endCol]]

                if showRuleId
                  {
                    type: if severity is 1 then 'warning' else 'error'
                    html: '<span class="badge badge-flexible">' + ruleId + '</span> ' + message
                    filePath: filePath
                    range: range
                  }
                else
                  {
                    type: if severity is 1 then 'warning' else 'error'
                    text: message
                    filePath: filePath
                    range: range
                  }

          results

        catch error
          console.warn '[Linter-ESLint] error while linting file'
          console.warn error.message
          console.warn error.stack

          [
            {
              type: 'error'
              text: 'error while linting file, open the console for more information'
              file: filePath
              range: [[0, 0], [0, 0]]
            }
          ]
      ###