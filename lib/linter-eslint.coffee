linterPath = atom.packages.getLoadedPackage('linter').path
Linter = require "#{linterPath}/lib/linter"
findFile = require "#{linterPath}/lib/util"

class LinterESLint extends Linter
  # The syntax that the linter handles. May be a string or
  # list/tuple of strings. Names should be all lowercase.
  @syntax: ['source.js']

  # A string, list, tuple,
  # containing the command line (with arguments) used to lint.
  Object.defineProperty(this.prototype, 'cmd', {
    get: ->
      cmd = 'eslint'

      config = findFile(@cwd, ['.eslintrc']) or @defaultEslintConfig

      # Relative to project root
      rulesDir = findFile(@cwd, [@rulesDir], false, 0) if @rulesDir

      if config
        cmd += " --config #{config}"

      if rulesDir
        cmd += " --rulesdir #{rulesDir}"

      cmd
  })

  linterName: 'eslint'

  # A regex pattern used to extract information from the executable's output.
  regex:
    '(?<line>\\d+):(?<col>\\d+) +((?<error>error)|(?<warning>warning)) +(?<message>.+)'

  isNodeExecutable: yes

  constructor: (editor) ->
    super(editor)

    atom.config.observe 'linter-eslint.eslintRulesDir', (newDir) =>
      @rulesDir = newDir

    atom.config.observe 'linter-eslint.eslintExecutablePath', (newPath) =>
      @executablePath = newPath

    atom.config.observe 'linter-eslint.defaultEslintConfig', (newDefaultConfig) =>
      @defaultEslintConfig = newDefaultConfig

  destroy: ->
    atom.config.unobserve 'linter-eslint.eslintExecutablePath'
    atom.config.unobserve 'linter-eslint.defaultEslintConfig'
    atom.config.unobserve 'linter-eslint.eslintRulesDir'

module.exports = LinterESLint
