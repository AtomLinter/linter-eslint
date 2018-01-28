'use babel'

// These are cases where the old setting should be directly moved to the new setting.
const directMoveMigrations = [
  /* Added January, 2018 */
  {
    old: 'disableWhenNoEslintConfig',
    new: 'disabling.disableWhenNoEslintConfig',
  }, {
    old: 'fixOnSave',
    new: 'autofix.fixOnSave'
  }, {
    old: 'ignoreFixableRulesWhileTyping',
    new: 'autofix.ignoreFixableRulesWhileTyping'
  }, {
    old: 'rulesToDisableWhileFixing',
    new: 'autofix.rulesToDisableWhileFixing'
  }, {
    old: 'rulesToSilenceWhileTyping',
    new: 'disabling.rulesToSilenceWhileTyping'
  }, {
    old: 'disableEslintIgnore',
    new: 'advanced.disableEslintIgnore'
  }, {
    old: 'disableFSCache',
    new: 'advanced.disableFSCache'
  }, {
    old: 'showRuleIdInMessage',
    new: 'advanced.showRuleIdInMessage'
  }, {
    old: 'eslintrcPath',
    new: 'global.eslintrcPath'
  }, {
    old: 'advancedLocalNodeModules',
    new: 'advanced.advancedLocalNodeModules'
  }, {
    old: 'eslintRulesDirs',
    new: 'advanced.eslintRulesDirs'
  }, {
    old: 'useGlobalEslint',
    new: 'global.useGlobalEslint'
  }, {
    old: 'globalNodePath',
    new: 'global.globalNodePath'
  },
]

function migrateConfigOptions() {
  const linterEslintConfig = atom.config.get('linter-eslint')

  /**
   * FIXME: Deprecated eslintRulesDir{String} option in favor of
   * eslintRulesDirs{Array<String>}. Remove in the next major release,
   * in v8.5.0, or after 2018-04.
   */
  const oldRulesdir = linterEslintConfig.eslintRulesDir
  if (oldRulesdir) {
    const newRulesDirs = linterEslintConfig.eslintRulesDirs
    if (newRulesDirs.length === 0) {
      atom.config.set('linter-eslint.eslintRulesDirs', [oldRulesdir])
    }
    atom.config.unset('linter-eslint.eslintRulesDir')
  }

  // Copy old settings over to the new ones, then unset the old setting keys
  directMoveMigrations.forEach((migration) => {
    const oldSetting = linterEslintConfig[migration.old]
    if (oldSetting !== undefined) {
      atom.config.set(migration.new, oldSetting)
      atom.config.unset(migration.old)
    }
  })
}

module.exports = migrateConfigOptions
