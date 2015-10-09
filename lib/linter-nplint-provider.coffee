path = require 'path'
{sync} = require 'resolve'
{execSync} = require 'child_process'
{statSync} = require 'fs'
{findFile} = require 'atom-linter'
{CompositeDisposable} = require 'atom'
{allowUnsafeNewFunction} = require 'loophole'

localNplint = false
warnNotFound = false

config = (key) ->
  atom.config.get "linter-nplint.#{key}"

requireLocalNpLint = (filePath) ->
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

requireNplint = (filePath) ->
  localNplint = false
  try
    nplint = requireLocalNpLint filePath
    localNplint = true
    return nplint
  catch error
    # if @useGlobalNpLint
    #   try
    #     nplintPath = sync 'nplint', {basedir: @npmPath}
    #     nplint = allowUnsafeNewFunction -> require nplintPath
    #     localNplint = true
    #     return nplint
    # else
    unless warnNotFound
      console.warn '[Linter-npLint] local `nplint` not found'
      console.warn error

      atom.notifications.addError '
        [Linter-npLint] `nplint` binary not found locally, falling back to packaged one.
        Plugins won\'t be loaded and linting will possibly not work.
        (Try `Use Global npLint` option, or install locally `nplint` to your project.)',
        {dismissable: true}

      warnNotFound = true

  # Fall back to the version packaged in linter-nplint
  return require('nplint')

LinterNplint =
  name: 'npLint'
  grammarScopes: ['source.json']
  scope: 'file'
  lintOnFly: config 'onTheFly'
  lint: (TextEditor) =>
    return new Promise (resolve, reject) =>
      filePath = TextEditor.getPath()
      filename = if filePath then path.basename filePath else ''
      console.log "[linter-nplint] skipping #{filePath}" if filename isnt 'package.json' and atom.inDevMode()
      return resolve([]) if filename isnt 'package.json'

      # Check for `onlyConfig`
      #
      # Return empty array if no `.nplintrc` && `onlyConfig`
      onlyConfig = config 'disableWhenNoNplintrcFileInPath'
      nplintConfig = findFile filePath, '.nplintrc'

      console.log "[linter-nplint] skipping cause not found .nplintrc" if onlyConfig and not nplintConfig and atom.inDevMode()
      return resolve([]) if onlyConfig and not nplintConfig

      # Add showRuleId option
      showRuleId = config 'showRuleIdInMessage'

      # `linter` and `CLIEngine` comes from `nplint` module
      {linter, CLIEngine} = requireNplint filePath

      engine = new CLIEngine()
      config = engine.getConfig()
      console.log "[linter-nplint] config: ", config if atom.inDevMode()

      try
        linter.verify TextEditor.getText(), config, ({messages}) ->
          console.log "[linter-nplint] message: ", messages if atom.inDevMode()
          resolve messages.map ({message, line, severity, ruleId, column}) ->

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

  # findGlobalNPMdir: ->
  #   try
  #     # Get global node dir from options
  #     globalNodePath = config 'globalNodePath'
  #
  #     # If none, try to find it
  #     unless globalNodePath
  #       globalNodePath = execSync 'npm config get prefix', {encoding: 'utf8'}
  #       globalNodePath = globalNodePath.replace /[\n\r\t]/g, ''
  #
  #     # Windows specific
  #     # (see: https://github.com/AtomLinter/linter-eslint/issues/138#issuecomment-118666827)
  #     globalNpmPath = path.join globalNodePath, 'node_modules'
  #
  #     # Other OS, `node_modules` path will be in `./lib/node_modules`
  #     try
  #       statSync(globalNpmPath).isDirectory()
  #     catch
  #       globalNpmPath = path.join globalNodePath, 'lib', 'node_modules'
  #
  #     if statSync(globalNpmPath).isDirectory()
  #       @useGlobalNpLint = true
  #       @npmPath = globalNpmPath
    #
    # catch error
    #   console.warn '[Linter-nplint] error loading global nplint'
    #   console.warn error
    #
    #   atom.notifications.addError '
    #     [Linter-npLint] Global node modules path not found, using packaged nplint.
    #     Plugins won\'t be loaded and linting will possibly not work.
    #     (Try to set `Global node path` if not set)',
    #     {dismissable: true}

module.exports = LinterNplint
