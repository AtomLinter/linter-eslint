path = require 'path'
{sync} = require 'resolve'
{execSync} = require 'child_process'
{statSync} = require 'fs'
{findFile} = require 'atom-linter'
{CompositeDisposable} = require 'atom'
{allowUnsafeNewFunction} = require 'loophole'

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
      description: 'Use globally installed `eslint`'
    showRuleIdInMessage:
      type: 'boolean'
      default: true
      description: 'Show the `eslint` rule before error'
    globalNodePath:
      type: 'string'
      default: ''
      description: 'Run `$ npm config get prefix` to find it'
    lintHtmlFiles:
      type: 'boolean'
      default: false
      description: 'Enable lint JavaScript in HTML files'

  activate: ->
    require('atom-package-deps').install('linter-eslint')
    console.log 'activate linter-eslint'
    @subscriptions = new CompositeDisposable

    # Load global eslint path
    if atom.config.get('linter-eslint.useGlobalEslint') then @findGlobalNPMdir()

    scopeEmbedded = 'source.js.embedded.html'
    @scopes = ['source.js', 'source.jsx', 'source.js.jsx', 'source.babel', 'source.js-semantic']
    @subscriptions.add atom.config.observe 'linter-eslint.lintHtmlFiles',
      (lintHtmlFiles) =>
        if lintHtmlFiles
          @scopes.push(scopeEmbedded) unless scopeEmbedded in @scopes
        else
          @scopes.splice(@scopes.indexOf(scopeEmbedded), 1) if scopeEmbedded in @scopes

  deactivate: ->
    @subscriptions.dispose()

  provideLinter: ->
    provider =
      name: 'ESLint'
      grammarScopes: @scopes
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

        return [] if onlyConfig and not eslintConfig

        # find nearest .eslintignore
        options = {}
        options.ignorePath = findFile filePath, '.eslintignore'

        # Add rulePaths option
        rulesDir = atom.config.get 'linter-eslint.eslintRulesDir'
        rulesDir = findFile(dirname, [rulesDir], false, 0) if rulesDir

        # Add showRuleId option
        showRuleId = atom.config.get 'linter-eslint.showRuleIdInMessage'

        # Add lintHtml option
        lintHtml = atom.config.get 'linter-eslint.lintHtmlFiles'

        if rulesDir
          try
            if statSync(rulesDir).isDirectory()
              options.rulePaths = [rulesDir]
          catch error
            console.warn '[Linter-ESLint] ESlint rules directory does not exist in your fs'
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
            config.plugins.forEach(@loadPlugin.bind(this, engine, filePath))

          if lintHtml
            if !config.plugins or (config.plugins and 'html' not in config.plugins)
              engine.addPlugin 'html', require('eslint-plugin-html')

          try
            results = []
            allowUnsafeNewFunction ->
              report = engine.executeOnText TextEditor.getText(), filePath
              messages = report.results[0].messages
              results = messages
                .map ({message, line, severity, ruleId, column}) ->

                  indentLevel = TextEditor.indentationForBufferRow line - 1
                  startCol = (column or TextEditor.getTabLength() * indentLevel) - 1
                  endOfLine = TextEditor.getBuffer().lineLengthForRow line - 1
                  range = [[line - 1, startCol], [line - 1, endOfLine]]

                  if showRuleId
                    {
                      type: if severity is 1 then 'Warning' else 'Error'
                      html: '<span class="badge badge-flexible">' + ruleId + '</span> ' + message
                      filePath: filePath
                      range: range
                    }
                  else
                    {
                      type: if severity is 1 then 'Warning' else 'Error'
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
                type: 'Error'
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
      eslint = @requireLocalESLint filePath
      @localEslint = true
      return eslint
    catch error
      if @useGlobalEslint
        try
          eslintPath = sync 'eslint', {basedir: @npmPath}
          eslint = allowUnsafeNewFunction -> require eslintPath
          @localEslint = true
          return eslint
      else
        unless @warnNotFound
          console.warn '[Linter-ESLint] local `eslint` not found'
          console.warn error

          atom.notifications.addError '
            [Linter-ESLint] `eslint` binary not found locally, falling back to packaged one.
            Plugins won\'t be loaded and linting will possibly not work.
            (Try `Use Global ESLint` option, or install locally `eslint` to your project.)',
            {dismissable: true}

          @warnNotFound = true

    # Fall back to the version packaged in linter-eslint
    return require('eslint')

  requireLocalESLint: (filePath) ->
    # Traverse up the directory hierarchy until the root
    currentPath = filePath
    until currentPath is path.dirname currentPath
      currentPath = path.dirname currentPath
      try
        eslintPath = sync 'eslint', {basedir: currentPath}
      catch
        continue
      return allowUnsafeNewFunction -> require eslintPath
    throw new Error "Could not find `eslint` locally installed in #{ path.dirname filePath } or any parent directories"

  findGlobalNPMdir: ->
    try
      # Get global node dir from options
      globalNodePath = atom.config.get 'linter-eslint.globalNodePath'

      # If none, try to find it
      unless globalNodePath
        globalNodePath = execSync 'npm config get prefix', {encoding: 'utf8', stdio: 'pipe'}
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
