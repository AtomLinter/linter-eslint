'use babel'

function migrateConfigOptions() {
  /**
   * FIXME: Deprecated eslintRulesDir{String} option in favor of
   * eslintRulesDirs{Array<String>}. Remove in the next major release,
   * in v8.5.0, or after 2018-04.
   */
  const oldRulesdir = atom.config.get('linter-eslint.eslintRulesDir')
  if (oldRulesdir) {
    const rulesDirs = atom.config.get('linter-eslint.eslintRulesDirs')
    if (rulesDirs.length === 0) {
      atom.config.set('linter-eslint.eslintRulesDirs', [oldRulesdir])
    }
    atom.config.unset('linter-eslint.eslintRulesDir')
  }

  /**
   * Move disableWhenNoEslintConfig into `disabling` section.
   * Added November, 2017
   */
  const oldDisableWhenNoEslintConfig = atom.config.get('linter-eslint.disableWhenNoEslintConfig')
  if (oldDisableWhenNoEslintConfig !== undefined) {
    atom.config.set('linter-eslint.disabling.disableWhenNoEslintConfig', oldDisableWhenNoEslintConfig)
    atom.config.unset('linter-eslint.disableWhenNoEslintConfig')
  }

  /**
   * Move ignoreFixableRulesWhileTyping into `disabling` section.
   * Added November, 2017
   */
  const oldIgnoreFixableRulesWhileTyping = atom.config.get('linter-eslint.ignoreFixableRulesWhileTyping')
  if (oldIgnoreFixableRulesWhileTyping !== undefined) {
    atom.config.set('linter-eslint.disabling.ignoreFixableRulesWhileTyping', oldIgnoreFixableRulesWhileTyping)
    atom.config.unset('linter-eslint.ignoreFixableRulesWhileTyping')
  }

  /**
   * Move rulesToDisableWhileFixing into `disabling` section.
   * Added November, 2017
   */
  const oldRulesToDisableWhileFixing = atom.config.get('linter-eslint.rulesToDisableWhileFixing')
  if (oldRulesToDisableWhileFixing !== undefined) {
    const newRulesToDisableWhileFixing = atom.config.get('linter-eslint.disabling.rulesToDisableWhileFixing')
    if (newRulesToDisableWhileFixing.length === 0) {
      atom.config.set('linter-eslint.disabling.rulesToDisableWhileFixing', oldRulesToDisableWhileFixing)
    }
    atom.config.unset('linter-eslint.rulesToDisableWhileFixing')
  }

  /**
   * Move rulesToSilenceWhileTyping into `disabling` section.
   * Added November, 2017
   */
  const oldRulesToSilenceWhileTyping = atom.config.get('linter-eslint.rulesToSilenceWhileTyping')
  if (oldRulesToSilenceWhileTyping !== undefined) {
    const newRulesToSilenceWhileTyping = atom.config.get('linter-eslint.disabling.rulesToSilenceWhileTyping')
    if (newRulesToSilenceWhileTyping.length === 0) {
      atom.config.set('linter-eslint.disabling.rulesToSilenceWhileTyping', oldRulesToSilenceWhileTyping)
    }
    atom.config.unset('linter-eslint.rulesToSilenceWhileTyping')
  }
}

module.exports = migrateConfigOptions
