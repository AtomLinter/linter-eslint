linterPath = atom.packages.getLoadedPackage('linter').path
Linter = require "#{linterPath}/lib/linter"
findFile = require "#{linterPath}/lib/util"

class LinterESLint extends Linter
  # The syntax that the linter handles. May be a string or
  # list/tuple of strings. Names should be all lowercase.
  @syntax: ['source.js']

  # A string, list, tuple or callable that returns a string, list or tuple,
  # containing the command line (with arguments) used to lint.
  cmd: 'eslint'

  linterName: 'eslint'

  # A regex pattern used to extract information from the executable's output.
  regex:
    '(?<line>\\d+):(?<col>\\d+) +((?<error>error)|(?<warning>warning)) +(?<message>.+)'

  isNodeExecutable: yes

  constructor: (editor) ->
    super(editor)

    config = findFile(@cwd, ['.eslintrc'])
    if config
      @cmd += " --config #{config}"

    rulesDir = atom.config.get 'linter-eslint.eslintRulesDir'
    if rulesDir
      @cmd += " --rulesdir #{rulesDir}"

    atom.config.observe 'linter-eslint.eslintExecutablePath', =>
      @executablePath = atom.config.get 'linter-eslint.eslintExecutablePath'

  destroy: ->
    atom.config.unobserve 'linter-eslint.eslintExecutablePath'

module.exports = LinterESLint
