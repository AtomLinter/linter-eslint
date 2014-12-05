linterPath = atom.packages.getLoadedPackage('linter').path
Linter = require "#{linterPath}/lib/linter"
findFile = require "#{linterPath}/lib/util"

path = require "path"
fs = require "fs"

eslint = require "eslint"
linter = eslint.linter
CLIEngine = eslint.CLIEngine


class LinterESLint extends Linter
  # The syntax that the linter handles. May be a string or
  # list/tuple of strings. Names should be all lowercase.
  @syntax: ['source.js']

  linterName: 'eslint'

  lintFile: (filePath, callback) ->
    filename = path.basename filePath
    origPath = path.join @cwd, filename
    options = {}

    rulesDir = findFile(@cwd, [@rulesDir], false, 0) if @rulesDir

    # find nearest .eslintignore
    options.ignorePath = findFile(origPath, '.eslintignore')
    # compute relative path to .eslintignore directory
    ralativeToIgnorePath = origPath.replace(path.dirname(options.ignorePath) + '/', '') if options.ignorePath

    # find rules directory
    if rulesDir && fs.existsSync(rulesDir)
      options.rulePaths = [rulesDir]

    # set file extensions to be linted
    options.extensions = @extensions

    console.log 'eslint opts', options

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
      @createMessage {
        line: m.line,
        col: m.column,
        error: m.severity is 2,
        warning: m.severity is 1,
        message: "#{m.message} (#{m.ruleId})"
      }

    callback(messages)

  constructor: (editor) ->
    super(editor)

    atom.config.observe 'linter-eslint.eslintRulesDir', (newDir) =>
      @rulesDir = newDir

    atom.config.observe 'linter-eslint.eslintExtensions', (newExts) =>
      @extensions = newExts

  destroy: ->
    atom.config.unobserve 'linter-eslint.eslintRulesDir'
    atom.config.unobserve 'linter-eslint.eslintExtensions'

module.exports = LinterESLint
