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

    if rulesDir && fs.existsSync(rulesDir)
      options.rulePaths = [rulesDir]

    config = new CLIEngine(options).getConfigForFile(origPath)
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

  destroy: ->
    atom.config.unobserve 'linter-eslint.eslintRulesDir'

module.exports = LinterESLint
