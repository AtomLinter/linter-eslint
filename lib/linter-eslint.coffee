path = require 'path'
{sync} = require 'resolve'
{execSync} = require 'child_process'
{statSync} = require 'fs'
{findFile} = require 'atom-linter'
{CompositeDisposable} = require 'atom'
{allowUnsafeNewFunction} = require 'loophole'

module.exports =
  config:
    nplintRulesDir:
      type: 'string'
      default: ''
    disableWhenNoNplintrcFileInPath:
      type: 'boolean'
      default: false
      description: 'Disable linter when no `.nplintrc` is found in project'
    useGlobalNpLint:
      type: 'boolean'
      default: false
      description: 'Use globally installed `nplint`'
    showRuleIdInMessage:
      type: 'boolean'
      default: true
      description: 'Show the `nplint` rule before error'
    globalNodePath:
      type: 'string'
      default: ''
      description: 'Run `$ npm config get prefix` to find it'

  activate: ->
    require('atom-package-deps').install('linter-nplint')
    console.log 'activate linter-nplint'
    @subscriptions = new CompositeDisposable

    # Load global nplint path
    if atom.config.get('linter-nplint.useGlobalNpLint') then @findGlobalNPMdir()

  deactivate: ->
    @subscriptions.dispose()

  provideLinter: ->
    provider =
      name: 'npLint'
      grammarScopes: ['source.json']
      scope: 'file'
      lintOnFly: false
      lint: (TextEditor) =>
        filePath = TextEditor.getPath()
        filename = if filePath then path.basename filePath else ''
        return [] if filename isnt 'package.json'

        dirname = if filePath then path.dirname filePath else ''

        # Check for `onlyConfig`
        #
        # Return empty array if no `.nplintrc` && `onlyConfig`
        onlyConfig = atom.config.get 'linter-nplint.disableWhenNoNplintrcFileInPath'
        nplintConfig = findFile filePath, '.nplintrc'

        return [] if onlyConfig and not nplintConfig

        # find nearest .nplintignore
        options = {}
        options.ignorePath = findFile filePath, '.nplintignore'

        # Add rulePaths option
        rulesDir = atom.config.get 'linter-nplint.nplintRulesDir'
        rulesDir = findFile(dirname, [rulesDir], false, 0) if rulesDir

        # Add showRuleId option
        showRuleId = atom.config.get 'linter-nplint.showRuleIdInMessage'

        if rulesDir
          try
            if statSync(rulesDir).isDirectory()
              options.rulePaths = [rulesDir]
          catch error
            console.warn '[Linter-npLint] nplint rules directory does not exist in your fs'
            console.warn error.message

        # `linter` and `CLIEngine` comes from `nplint` module
        {linter, CLIEngine} = @requireNpLint filePath

        if filePath
          engine = new CLIEngine(options)

          config = {}
          allowUnsafeNewFunction ->
            config = engine.getConfig

          # Check for ignore path files from `.nplintignore`
          if options.ignorePath
            relative = filePath.replace "#{path.dirname options.ignorePath}#{path.sep}", ''
            return [] if engine.isPathIgnored relative or engine.isPathIgnored "#{relative}/"

          # We have plugins to load
          if config.plugins
            config.plugins.forEach(@loadPlugin.bind(this, engine, filePath))

          return new Promise (resolve)->
            try
              results = []
              allowUnsafeNewFunction ->
                results = linter
                  .verify TextEditor.getText(), config, ({messages})->
                    messages.map ({message, line, severity, ruleId, column}) ->

                      indentLevel = TextEditor.indentationForBufferRow line - 1
                      startCol = column or TextEditor.getTabLength() * indentLevel
                      endOfLine = TextEditor.getBuffer().lineLengthForRow line - 1
                      range = [[line - 1, startCol], [line - 1, endOfLine]]

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
                    resolve results

            catch error
              console.warn '[Linter-npLint] error while linting file'
              console.warn error.message
              console.warn error.stack

              resolve [
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

    npmPluginName = pluginName.replace 'nplint-plugin-', ''
    npmPluginName = "#{namespace}nplint-plugin-#{npmPluginName}"

    try
      pluginPath = sync npmPluginName, {basedir: path.dirname(filePath)}
      plugin = require pluginPath

      return engine.addPlugin pluginName, plugin
    catch error
      if @useGlobalNpLint
        try
          pluginPath = sync npmPluginName, {basedir: @npmPath}
          plugin = require pluginPath

          return engine.addPlugin pluginName, plugin

    console.warn "[Linter-npLint] error loading plugin"
    console.warn error.message
    console.warn error.stack

    atom.notifications.addError "[Linter-npLint] plugin #{pluginName} not found", {dismissable: true}

  requireNpLint: (filePath) ->
    @localNpLint = false
    try
      nplint = @requireLocalNpLint filePath
      @localNpLint = true
      return nplint
    catch error
      if @useGlobalNpLint
        try
          nplintPath = sync 'nplint', {basedir: @npmPath}
          nplint = allowUnsafeNewFunction -> require nplintPath
          @localNpLint = true
          return nplint
      else
        unless @warnNotFound
          console.warn '[Linter-npLint] local `nplint` not found'
          console.warn error

          atom.notifications.addError '
            [Linter-npLint] `nplint` binary not found locally, falling back to packaged one.
            Plugins won\'t be loaded and linting will possibly not work.
            (Try `Use Global npLint` option, or install locally `nplint` to your project.)',
            {dismissable: true}

          @warnNotFound = true

    # Fall back to the version packaged in linter-nplint
    return require('nplint')

  requireLocalNpLint: (filePath) ->
    # Traverse up the directory hierarchy until the root
    currentPath = filePath
    until currentPath is path.dirname currentPath
      currentPath = path.dirname currentPath
      try
        nplintPath = sync 'nplint', {basedir: currentPath}
      catch
        continue
      return allowUnsafeNewFunction -> require nplintPath
    throw new Error "Could not find `nplint` locally installed in #{ path.dirname filePath } or any parent directories"

  findGlobalNPMdir: ->
    try
      # Get global node dir from options
      globalNodePath = atom.config.get 'linter-nplint.globalNodePath'

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
        @useGlobalNpLint = true
        @npmPath = globalNpmPath

    catch error
      console.warn '[Linter-nplint] error loading global nplint'
      console.warn error

      atom.notifications.addError '
        [Linter-npLint] Global node modules path not found, using packaged nplint.
        Plugins won\'t be loaded and linting will possibly not work.
        (Try to set `Global node path` if not set)',
        {dismissable: true}
