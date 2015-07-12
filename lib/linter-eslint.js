'use babel'

import path from 'path'
import which from 'npm-which'
import {exec, findFile} from 'atom-linter'

export default {
  config: {
    lintOnEdit: {
      type: 'boolean',
      default: true,
      description: 'Lint file while editing'
    },
    eslintRulesDir: {
      type: 'string',
      default: '',
      description: 'Use additional rules from this directory'
    },
    showRuleIdInMessage: {
      type: 'boolean',
      default: true,
      description: 'Show the `ESlint` rule before the issue message'
    },
    disableWhenNoEslintrcFileInPath: {
      type: 'boolean',
      default: false,
      description: 'Disable linter when no `.eslintrc` is found in project'
    },
    eslintPath: {
      type: 'string',
      default: '',
      description: 'Fallback to this path when package can not find eslint binary'
    },
    fileExtensions: {
      type: 'string',
      default: '.js',
      description: 'Lint files with these file extensions (separated by commas)'
     }
  },

  activate() {
    console.log('activate `linter-eslint`')
  },

  provideLinter() {
    return {
      grammarScopes: [
        'source.js', 'source.js.jsx', 'source.babel',
        'source.js-semantic'
      ],
      scope: 'file',
      lintOnFly: atom.config.get('linter-eslint.lintOnEdit'),
      lint: ::this.lint
    }
  },

  findESLint(cwd) {
    return new Promise(resolve => {
      // Return cached copy of binary path
      if (this.binary) return resolve(this.binary)

      // Try to find ESLint binary locally and globally
      return which('eslint', {cwd}, (error, eslint) => {
        eslint = eslint || atom.config.get('linter-eslint.eslintPath')
        eslint = eslint.trim()

        this.binary = eslint
        return resolve(eslint)
      })
    })
  },

  findProjectPath(filePath) {
    let result
    const projectPaths = atom.project.getPaths()
    projectPaths.forEach(function (projectPath) {
      if (filePath.match(projectPath)) result = projectPath
    })
    return result
  },

  async lint(TextEditor) {
    let params = []
    const filePath = TextEditor.getPath()

    const defaultParams = [
      '--format', path.join(__dirname, '..', 'node_modules', 'eslint-json', 'json.js'),
      '--stdin'
    ]

    // Add `--rulesdir` param if specified in options
    const rulesDir = atom.config.get('eslintRulesDir')
    if (rulesDir) params = [...params, '--rulesdir', rulesDir]

    // Halt if we don't have an `.eslintrc` and option is enabled
    const config = findFile(filePath, '.eslintrc')
    const onlyConfig = atom.config
      .get('linter-eslint.disableWhenNoEslintrcFileInPath')
    if (onlyConfig && !config) return []

    // Find ESLint, first try to match
    // locally installed ESLint if option isn't disabled
    let cwd = findFile(filePath, 'node_modules')
    cwd = this.findProjectPath(filePath) || (cwd && path.resolve(cwd, '..')) || path.sep
    let eslint = await this.findESLint(cwd)

    // We didn't find ESLint binary
    // warn the user we are falling back on packaged one
    if (!eslint) {
      atom.notifications
        .addWarning('`[Linter-ESLint]` Local/Global ESLint binary not found. Fallback to packaged one. Set binary in preferences.', {dismissable: true})
      eslint = path.resolve(__dirname, '..', 'node_modules', '.bin', 'eslint')
      cwd = __dirname
    }

		// Add file extensions to params
    params.push('--ext', atom.config.get('fileExtensions'))

    // Remove `cwd` from filePath
    params.push('--stdin-filename', filePath.replace(cwd + path.sep, ''))
    if (config) params = [...params, '--config', config.replace(cwd + path.sep, '')]

    // Push default params after added additional ones
    params = [...params, ...defaultParams]

    // Exec the CLI with correct params
    const output = await exec(eslint, params, {stdin: TextEditor.getText(), cwd})

    let results
    let messages

    // Catch when no output is provided by CLI
    if (!output || (output && !output.trim())) {
      console.warn('[Linter-ESLint] no output from CLI')
      console.warn(`eslint binary: ${eslint}`)
      console.warn(`params: ${params.join(' ')}`)
      console.warn(`cwd: ${cwd}`)

      messages = [{
        line: 1,
        severity: 2,
        message: '[Linter-ESLint] no output provided by eslint, open console for more informations'
      }]
    } else {
      // Parse the ouput, take the needed stuff
      try {
        results = JSON.parse(output).results
        messages = results[0].messages || []
      } catch (error) {
        console.warn('[Linter-ESLint] error while parsing ouput:')
        console.warn(output)

        messages = [{
          line: 1,
          severity: 2,
          message: '[Linter-ESLint] error while parsing output, open console for more informations'
        }]
      }
    }


    // Display or not the ruleID in message
    const showRuleID = atom.config.get('linter-eslint.showRuleIdInMessage')

    // Return issues formatted for base `Linter`
    return messages.map(function ({line, message, severity, ruleId}) {
      // Enforce line will always be in buffer
      line = line || 1

      const indentLevel = TextEditor.indentationForBufferRow(line - 1)
      const startCol = TextEditor.getTabLength() * indentLevel
      const endCol = TextEditor.getBuffer().lineLengthForRow(line - 1)
      const range = [[line - 1, startCol], [line - 1, endCol]]

      const type = (severity === 1) ? 'warning' : 'error'
      const props = {range, filePath, type}

      if (showRuleID && ruleId) {
        props.html = `<span class='badge badge-flexible'>${ruleId}</span> ${message}`
      } else {
        props.text = message
      }

      return props
    })
  }
}
