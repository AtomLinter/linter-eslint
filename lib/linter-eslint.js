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

  findESLint() {
    return new Promise(function (resolve) {
      // Return cached copy of binary path
      if (this.binary) return resolve(this.binary)

      // Try to find ESLint binary localy and globaly
      const [cwd] = atom.project.getPaths()
      return which('eslint', {cwd}, function (error, eslint) {
        eslint = eslint || atom.config.get('linter-eslint.eslintPath')
        eslint = eslint.trim()

        this.binary = eslint
        return resolve(eslint)
      })
    })
  },

  async lint(TextEditor) {
    const filePath = TextEditor.getPath()
    const params = []

    const defaultParams = [
      '--format', path.join(__dirname, '..', 'node_modules', 'eslint-json', 'json.js'),
      '--stdin-filename', filePath,
      '--stdin'
    ]

    // Add `--rulesdir` param if specified in options
    const rulesDir = atom.config.get('eslintRulesDir')
    if (rulesDir) params.push('--rulesdir', rulesDir)

    // Add `--config` param if `.eslintrc` is present
    const config = findFile(filePath, '.eslintrc')
    if (config) params.push('--config', config)

    // Halt if we don't have an `.eslintrc` and option is enabled
    const onlyConfig = atom.config
      .get('linter-eslint.disableWhenNoEslintrcFileInPath')
    if (onlyConfig && !config) return []

    // Push default params after added additional ones
    params.push(...defaultParams)

    // Find ESLint, first try to match
    // locally installed ESLint if option isn't disabled
    let eslint = await this.findESLint()

    // We didn't find ESLint binary
    // tell the user we are falling back on packaged one
    if (!eslint) {
      atom.notifications
        .addError('`[Linter-ESLint] Local/Global `eslint` binary not found. Fallback to packaged one. Set binary in preferences.', {dismissable: true})
      eslint = path.join('..', 'node_modules', '.bin', 'eslint')
    }

    // Exec the CLI with correct params
    const output = await exec(eslint, params, {stdin: TextEditor.getText()})

    // Parse the ouput, take the needed stuff
    const {results} = JSON.parse(output)
    const {messages = []} = results[0] || {}

    // Display or not the ruleID in message
    const showRuleID = atom.config.get('linter-eslint.showRuleIdInMessage')

    // Return issues formatted for base `Linter`
    return messages.map(function ({line, message, severity, ruleId}) {
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
