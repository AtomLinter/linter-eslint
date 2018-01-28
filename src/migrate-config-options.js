'use babel'

// These are cases where the old setting should be directly moved to the new setting.
const directMoveMigrations = [
  {
    /* Added November, 2017 */
    old: 'linter-eslint.disableWhenNoEslintConfig',
    new: 'linter-eslint.disabling.disableWhenNoEslintConfig',
  },
  {
    /* Added November, 2017 */
    old: 'linter-eslint.fixOnSave',
    new: 'linter-eslint.autofix.fixOnSave'
  },
  {
    /* Added November, 2017 */
    old: 'linter-eslint.ignoreFixableRulesWhileTyping',
    new: 'linter-eslint.autofix.ignoreFixableRulesWhileTyping'
  },
  {
    /* Added November, 2017 */
    old: 'linter-eslint.rulesToDisableWhileFixing',
    new: 'linter-eslint.autofix.rulesToDisableWhileFixing'
  },
  {
    /* Added November, 2017 */
    old: 'linter-eslint.rulesToSilenceWhileTyping',
    new: 'linter-eslint.disabling.rulesToSilenceWhileTyping'
  },
  {
    /* Added November, 2017 */
    old: 'linter-eslint.disableEslintIgnore',
    new: 'linter-eslint.advanced.disableEslintIgnore'
  },
  {
    /* Added November, 2017 */
    old: 'linter-eslint.disableFSCache',
    new: 'linter-eslint.advanced.disableFSCache'
  },
  {
    /* Added November, 2017 */
    old: 'linter-eslint.showRuleIdInMessage',
    new: 'linter-eslint.advanced.showRuleIdInMessage'
  },
  {
    /* Added November, 2017 */
    old: 'linter-eslint.eslintrcPath',
    new: 'linter-eslint.global.eslintrcPath'
  },
  {
    /* Added November, 2017 */
    old: 'linter-eslint.advancedLocalNodeModules',
    new: 'linter-eslint.advanced.advancedLocalNodeModules'
  },
  {
    /* Added November, 2017 */
    old: 'linter-eslint.eslintRulesDirs',
    new: 'linter-eslint.advanced.eslintRulesDirs'
  },
  {
    /* Added November, 2017 */
    old: 'linter-eslint.useGlobalEslint',
    new: 'linter-eslint.global.useGlobalEslint'
  },
  {
    /* Added November, 2017 */
    old: 'linter-eslint.globalNodePath',
    new: 'linter-eslint.global.globalNodePath'
  },
]

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

  // Copy old settings over to the new ones, then unset the old setting keys
  directMoveMigrations.forEach((migration) => {
    const oldSetting = atom.config.get(migration.old)
    if (oldSetting !== undefined) {
      atom.config.set(migration.new, oldSetting)
      atom.config.unset(migration.old)
    }
  })
}

module.exports = migrateConfigOptions
