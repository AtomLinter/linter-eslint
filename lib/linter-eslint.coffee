fs = require 'fs'
path = require 'path'
{sync} = require 'resolve'
{exec} = require 'child_process'
{CompositeDisposable} = require 'atom'
{allowUnsafeNewFunction} = require 'loophole'

linterPath = atom.packages.getLoadedPackage('linter').path
findFile = require "#{linterPath}/lib/util"

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
    @subscriptions = new CompositeDisposable

    # Load global eslint path
    @useGlobalEslint = atom.config.get 'linter-eslint.useGlobalEslint'
    if @useGlobalEslint then @_findGlobalNpmDir()

  deactivate: ->
    @subscriptions.dispose()

  provideLinter: ->
    provider =
      grammarScopes: ['source.js', 'source.js.jsx', 'source.babel', 'source.js-semantic']
      scope: 'file'
      lintOnFly: true
      lint: (TextEditor) =>
        filePath = TextEditor.getPath()
        origPath = if filePath then path.dirname filePath else ''

        # Check for `onlyConfig`
        #
        # Return empty array if no `.eslintrc` && `onlyConfig`
        onlyConfig = atom.config.get 'linter-eslint.disableWhenNoEslintrcFileInPath'
        eslintConfig = findFile origPath, '.eslintrc'

        return [] if onlyConfig and !eslintConfig

        # find nearest .eslintignore
        options = {}
        options.ignorePath = findFile origPath, '.eslintignore'

        # Add rulePaths option
        rulesDir = atom.config.get 'linter-eslint.eslintRulesDir'
        rulesDir = findFile @cwd, [rulesDir], false, 0 if rulesDir

        if rulesDir and fs.existsSync rulesDir
          options.rulePaths = [rulesDir]

        # `linter` and `CLIEngine` comes from `eslint` module
        {linter, CLIEngine} = @_requireEsLint origPath

        if filePath
          engine = new CLIEngine(options)

          # Fixes `eslint@0.23.0`
          config = {}
          allowUnsafeNewFunction ->
            config = engine.getConfigForFile origPath

          # Check for ignore path files from `.eslintignore`
          if options.ignorePath
            relative = origPath.replace "#{path.dirname options.ignorePath}#{path.sep}", ''
            return [] if engine.isPathIgnored relative or engine.isPathIgnored "#{relative}/"

          # We have plugins to load
          if config.plugins

            # `eslint >= 0.21.0`
            if engine.addPlugin
              config.plugins
                .forEach this._loadPlugin.bind this, engine, origPath
            else
              options.plugins = config.plugins
              engine = new CLIEngine(options)

          try
            results = []
            allowUnsafeNewFunction ->
              results = linter
                .verify TextEditor.getText(), config
                .map ({message, line, severity}) ->

                  # Calculate range to make the error whole line
                  # without the indentation at begining of line
                  indentLevel = TextEditor.indentationForBufferRow line - 1
                  startCol = TextEditor.getTabLength() * indentLevel
                  endCol = TextEditor.getBuffer().lineLengthForRow line - 1
                  range = [[line - 1, startCol], [line - 1, endCol]]

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
                text: 'error while linting file, open console for more informations'
                file: filePath
                range: [[0, 0], [0, 0]]
              }
            ]

  _loadPlugin: (engine, basedir, pluginName) ->
    try
      pluginName = pluginName.replace 'eslint-plugin-', ''
      pluginPath = sync "eslint-plugin-#{pluginName}", {basedir}
      plugin = require pluginPath

      engine.addPlugin pluginName, plugin
    catch error
      console.warn "[Linter-ESLint] error loading plugin"
      console.warn error.message
      console.warn error.stack

      atom.notifications.addError "[Linter-ESLint] plugin #{pluginName} not found", {dismissable: true}

  _requireEsLint: (filePath) ->
    @localEslint = false
    try
      eslintPath = sync 'eslint', {basedir: path.dirname(filePath)}
      eslint = require eslintPath
      @localEslint = true
      return eslint
    catch
      if @useGlobalEslint
        try
          eslintPath = sync 'eslint', {basedir: @npmPath}
          eslint = require eslintPath
          @localEslint = true
          return eslint
    # Fall back to the version packaged in linter-eslint
    return require('eslint')

  _findGlobalNpmDir: ->
    exec 'npm config get prefix', (code, stdout, stderr) =>
      if not stderr
        cleanPath = stdout.replace(/[\n\r\t]/g, '')
        dir = path.join(cleanPath, 'lib', 'node_modules')
        fs.exists dir, (exists) =>
          if exists
            @npmPath = dir
