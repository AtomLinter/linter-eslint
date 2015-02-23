linterPath = atom.packages.getLoadedPackage('linter').path
Linter = require "#{linterPath}/lib/linter"
findFile = require "#{linterPath}/lib/util"
resolve = require('resolve').sync

path = require "path"
fs = require "fs"

class LinterESLint extends Linter
  # The syntax that the linter handles. May be a string or
  # list/tuple of strings. Names should be all lowercase.
  @syntax: ['source.js', 'source.js.jsx']

  @disableWhenNoEslintrcFileInPath = false

  linterName: 'eslint'

  _requireEsLint: (filePath) ->
    try
      eslintPath = resolve('eslint', {
        basedir: path.dirname(filePath)
      })
      return require(eslintPath)
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
    ralativeToIgnorePath = origPath.replace(path.dirname(options.ignorePath) + '/', '') if options.ignorePath

    # find rules directory
    if rulesDir && fs.existsSync(rulesDir)
      options.rulePaths = [rulesDir]

    # init eslint CLIEngine (cli engine is used for getting linter config and test ignored files)
    engine = new CLIEngine(options)

    # check if ignored
    if options.ignorePath and engine.isPathIgnored(ralativeToIgnorePath)
      return callback([])

    config = engine.getConfigForFile(origPath)

    # Currently, linter-eslinter does not support eslint plugins. To not cause
    # any "Definition for rule ... was not found." errors, we remove any plugin
    # based rules from the config.
    #
    # More information: https://github.com/AtomLinter/linter-eslint/issues/16
    if config.plugins?.length
      isPluginRule = new RegExp("^(#{config.plugins.join('|')})/")
      Object.keys(config.rules).forEach (key) ->
        delete config.rules[key] if isPluginRule.test(key)

    result = linter.verify @editor.getText(), config

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

    atom.config.observe 'linter-eslint.eslintRulesDir', (newDir) =>
      @rulesDir = newDir

    atom.config.observe 'linter-eslint.disableWhenNoEslintrcFileInPath', (skipNonEslint) =>
      @disableWhenNoEslintrcFileInPath = skipNonEslint

  destroy: ->
    atom.config.unobserve 'linter-eslint.eslintRulesDir'

module.exports = LinterESLint
