linterPath = atom.packages.getLoadedPackage("linter").path
Linter = require "#{linterPath}/lib/linter"
{findFile, warn} = require "#{linterPath}/lib/utils"

class Lintereslint extends Linter
  # The syntax that the linter handles. May be a string or
  # list/tuple of strings. Names should be all lowercase.
  @syntax: ['source.js']

  # A string, list, tuple or callable that returns a string, list or tuple,
  # containing the command line (with arguments) used to lint.
  @cmd: ['eslint', '--format', 'compact']

  linterName: 'eslint'

  # A regex pattern used to extract information from the executable's output.
  regex:
    # capture line and col
    '.+?: line (?<line>[0-9]+), col (?<col>[0-9]+), ' +
    # capture error, warning and code
    '((?<error>Error)|(?<warning>Warning)) - ' +
    # capture message
    '(?<message>.+)'

  isNodeExecutable: yes

  constructor: (editor) ->
    super editor

    atom.config.observe 'linter-eslint.eslintExecutablePath', (value) =>
      @executablePath = "#{value}"

  lintFile: (filePath, callback) ->
    @cmd = @constructor.cmd

    # config path (and possible disable on non-existing filepath)
    config = findFile @cwd, ['.eslintrc']
    disableWhenNoEslintrcFileInPath = atom.config.get 'linter-eslint.disableWhenNoEslintrcFileInPath'
    if config
      @cmd = @cmd.concat ['--config', config]
    else if disableWhenNoEslintrcFileInPath
      return

    # custom eslint rules directory
    eslintRulesDir = atom.config.get 'linter-eslint.eslintRulesDir'
    if eslintRulesDir
      path = findFile @cwd, [eslintRulesDir]
      @cmd = @cmd.concat ['--rulesdir', path]

    super filePath, callback

  destroy: ->
    atom.config.unobserve 'linter-eslint.eslintExecutablePath'

module.exports = Lintereslint
