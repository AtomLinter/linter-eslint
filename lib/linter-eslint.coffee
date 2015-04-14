linterPath = atom.packages.getLoadedPackage('linter').path
Linter = require "#{linterPath}/lib/linter"
findFile = require "#{linterPath}/lib/util"
resolve = require('resolve').sync
{allowUnsafeNewFunction} = require 'loophole'

path = require "path"
fs = require "fs"

class LinterESLint extends Linter
  # The syntax that the linter handles. May be a string or
  # list/tuple of strings. Names should be all lowercase.
  @syntax: ['source.js', 'source.js.jsx']

  @disableWhenNoEslintrcFileInPath = false

  linterName: 'eslint'

  _requireEsLint: (filePath) ->
    @localEslint = false
    try
      eslintPath = resolve('eslint', {
        basedir: path.dirname(filePath)
      })
      eslint = require(eslintPath)
      @localEslint = true
      return eslint
    # Fall back to the version packaged in linster-eslint
    return require('eslint')

  lintFile: (filePath, callback) ->

    filename = path.basename filePath
    origPath = path.join @cwd, filename
    options = {}
    { linter, CLIEngine } = @_requireEsLint(origPath)

    eslintrc = findFile(origPath, '.eslintrc')

    if not eslintrc and @disableWhenNoEslintrcFileInPath
      return

    rulesDir = findFile(@cwd, [@rulesDir], false, 0) if @rulesDir

    # find nearest .eslintignore
    options.ignorePath = findFile(origPath, '.eslintignore')
    # compute relative path to .eslintignore directory
    ralativeToIgnorePath = origPath.replace(path.dirname(options.ignorePath) + path.sep, '') if options.ignorePath

    # find rules directory
    if rulesDir && fs.existsSync(rulesDir)
      options.rulePaths = [rulesDir]

    # init eslint CLIEngine (cli engine is used for getting linter config and test ignored files)
    engine = new CLIEngine(options)

    # check if ignored
    if options.ignorePath and engine.isPathIgnored(ralativeToIgnorePath)
      return callback([])

    config = engine.getConfigForFile(origPath)

    # This sidesteps a chicken and egg problem:
    # CLIEngine contains loadPlugins() that is not exposed, so we can't call it
    # directly. The plugins need to be passed into CLIEngine, but we don't know
    # which plugins are loaded until after we load CLIEngine.
    #
    # If you are loading plugins this will replace the existing engine with a
    # new engine where we can pass in the set of plugins for it to load.
    if config.plugins?.length
      if @localEslint
        options.plugins = config.plugins
        engine = new CLIEngine(options)
      else
        isPluginRule = new RegExp("^(#{config.plugins.join('|')})/")
        Object.keys(config.rules).forEach (key) ->
          delete config.rules[key] if isPluginRule.test(key)

    # wrap `eslint()` into `allowUnsafeNewFunction`
    # https://discuss.atom.io/t/--template-causes-unsafe-eval-error/9310
    # https://github.com/babel/babel/blob/master/src/acorn/src/identifier.js#L46
    result = null
    allowUnsafeNewFunction =>
      result = linter.verify @editor.getText(), config

    if config.plugins?.length and not @localEslint
      result.push({
        line: 1
        column: 0
        severity: 1
        message: "`npm install eslint` in your project to enable plugins:
        #{config.plugins.join(', ')} (linter-eslint)"
      })

    messages = result.map (m) =>
      message = m.message
      if m.ruleId?
        message += " (#{m.ruleId})"

      @createMessage {
        line: m.line,
        col: m.column,
        error: m.severity is 2,
        warning: m.severity is 1,
        message: message
      }

    callback(messages)

  constructor: (editor) ->
    super(editor)

    @rulesDirListener = atom.config.observe 'linter-eslint.eslintRulesDir', (newDir) =>
      @rulesDir = newDir

    atom.config.observe 'linter-eslint.disableWhenNoEslintrcFileInPath', (skipNonEslint) =>
      @disableWhenNoEslintrcFileInPath = skipNonEslint

  destroy: ->
    @rulesDirListener.dispose()

module.exports = LinterESLint
