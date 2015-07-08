path = require 'path'
{sync} = require 'resolve'
{execSync} = require 'child_process'
{statSync} = require 'fs'
{CompositeDisposable} = require 'atom'
{allowUnsafeNewFunction} = require 'loophole'

linterPackage = atom.packages.getLoadedPackage 'linter'
unless linterPackage
  return atom.notifications.addError 'Linter should be installed first, `apm install linter`', dismissable: true

linterPath = linterPackage.path
findFile = require "#{linterPath}/lib/util"

module.exports =
  config:
    eslintRulesDir:
      type: 'string'
      default: ''
    disableWhenNoEslintrcFileInPath:
      type: 'boolean'
      default: false
      description: 'Disable linter when no `.eslintrc` is found in project'
    useGlobalEslint:
      type: 'boolean'
      default: false
      description: 'Use globaly installed `eslint`'
    showRuleIdInMessage:
      type: 'boolean'
      default: true
      description: 'Show the `eslint` rule before error'
    globalNodePath:
      type: 'string'
      default: ''
      description: 'Run `$ npm config get prefix` to find it'

  activate: ->
    console.log 'activate linter-eslint'
    @subscriptions = new CompositeDisposable

    # Load global eslint path
    if atom.config.get('linter-eslint.useGlobalEslint') then @findGlobalNPMdir()

  deactivate: ->
    @subscriptions.dispose()

  provideLinter: ->
    provider =
      grammarScopes: ['source.js', 'source.js.jsx', 'source.babel', 'source.js-semantic']
      scope: 'file'
      lintOnFly: true
      lint: (TextEditor) =>
        filePath = TextEditor.getPath()
        dirname = if filePath then path.dirname filePath else ''

        # Check for `onlyConfig`
        #
        # Return empty array if no `.eslintrc` && `onlyConfig`
        onlyConfig = atom.config.get 'linter-eslint.disableWhenNoEslintrcFileInPath'
        eslintConfig = findFile filePath, '.eslintrc'

        return [] if onlyConfig and !eslintConfig

        # find nearest .eslintignore
        options = {}
        options.ignorePath = findFile filePath, '.eslintignore'

        # Add rulePaths option
        rulesDir = atom.config.get 'linter-eslint.eslintRulesDir'
        rulesDir = findFile(dirname, [rulesDir], false, 0) if rulesDir

        # Add showRuleId option
        showRuleId = atom.config.get 'linter-eslint.showRuleIdInMessage'

        if rulesDir
          try
            if statSync(rulesDir).isDirectory()
              options.rulePaths = [rulesDir]
          catch error
            console.warn '[Linter-ESLint] ESlint rules direcotory does not exist in your fs'
            console.warn error.message

        # `linter` and `CLIEngine` comes from `eslint` module
        {linter, CLIEngine} = @requireESLint filePath

        if filePath
          engine = new CLIEngine(options)

          # Fixes `eslint@0.23.0`
          config = {}
          allowUnsafeNewFunction ->
            config = engine.getConfigForFile filePath

          # Check for ignore path files from `.eslintignore`
          if options.ignorePath
            relative = filePath.replace "#{path.dirname options.ignorePath}#{path.sep}", ''
            return [] if engine.isPathIgnored relative or engine.isPathIgnored "#{relative}/"

          # We have plugins to load
          if config.plugins

            # `eslint >= 0.21.0`
            if engine.addPlugin
              config.plugins.forEach(@loadPlugin.bind(this, engine, filePath))
            else
              options.plugins = config.plugins
              engine = new CLIEngine(options)

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

  loadPlugin: (engine, filePath, pluginName) ->
    # Support private modules for plugins
    # they starts with `@`
    namespace = ''
    if pluginName[0] is '@'
      [namespace, pluginName] = pluginName.split '/'
      namespace += '/'

    npmPluginName = pluginName.replace 'eslint-plugin-', ''
    npmPluginName = "#{namespace}eslint-plugin-#{npmPluginName}"

    try
      pluginPath = sync npmPluginName, {basedir: path.dirname(filePath)}
      plugin = require pluginPath

      return engine.addPlugin pluginName, plugin
    catch error
      if @useGlobalEslint
        try
          pluginPath = sync npmPluginName, {basedir: @npmPath}
          plugin = require pluginPath

          return engine.addPlugin pluginName, plugin

    console.warn "[Linter-ESLint] error loading plugin"
    console.warn error.message
    console.warn error.stack

    atom.notifications.addError "[Linter-ESLint] plugin #{pluginName} not found", {dismissable: true}

  requireESLint: (filePath) ->
    @localEslint = false
    try
      eslintPath = sync 'eslint', {basedir: path.dirname(filePath)}
      eslint = require eslintPath
      @localEslint = true
      return eslint
    catch error
      if @useGlobalEslint
        try
          eslintPath = sync 'eslint', {basedir: @npmPath}
          eslint = require eslintPath
          @localEslint = true
          return eslint
      else
        console.warn '[Linter-ESLint] local `eslint` not found'
        console.warn error

        atom.notifications.addError '
          [Linter-ESLint] `eslint` binary not found localy, falling back to packaged one.
          Plugins won\'t be loaded and linting will possibly not work.
          (Try `Use Global ESLint` option, or install localy `eslint` to your project.)',
          {dismissable: true}

    # Fall back to the version packaged in linter-eslint
    return require('eslint')

  findGlobalNPMdir: ->
    try
      # Get global node dir from options
      globalNodePath = atom.config.get 'linter-eslint.globalNodePath'

      # If none, try to find it
      unless globalNodePath
        globalNodePath = execSync 'npm config get prefix', {encoding: 'utf8'}
        globalNodePath = globalNodePath.replace /[\n\r\t]/g, ''

      # Windows specific
      # (see: https://github.com/AtomLinter/linter-eslint/issues/138#issuecomment-118666827)
      globalNpmPath = path.join globalNodePath, 'node_modules'

      # Other OS, `node_modules` path will be in `./lib/node_modules`
      try
        statSync(globalNpmPath).isDirectory()
      catch
        globalNpmPath = path.join globalNodePath, 'lib', 'node_modules'

      if statSync(globalNpmPath).isDirectory()
        @useGlobalEslint = true
        @npmPath = globalNpmPath

    catch error
      console.warn '[Linter-ESlint] error loading global eslint'
      console.warn error

      atom.notifications.addError '
        [Linter-ESLint] Global node modules path not found, using packaged ESlint.
        Plugins won\'t be loaded and linting will possibly not work.
        (Try to set `Global node path` if not set)',
        {dismissable: true}
