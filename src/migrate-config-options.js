'use babel'

/*
 * These migrations can take one of two forms, a direct move or a general function.
 *
 * Direct move:
 *   These objects have an array of `moves`, which
 *   are objects containing an `old` setting name and a `new` setting name.
 *   Any existing config found in the `old` name will be moved over to (and overwrite)
 *   the `new` key.
 *
 * Functions:
 *   These have a `migrate` function, which takes the
 *   current linter-eslint atom config as an argument, and can act on it however
 *   it needs to.
 */
const activeMigrations = [
  {
    added: 'January, 2018',
    description: 'Organized config settings into sections',
    moves: [
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
        new: 'advanced.localNodeModules'
      }, {
        old: 'eslintRulesDirs',
        new: 'advanced.eslintRulesDirs'
      }, {
        old: 'useGlobalEslint',
        new: 'global.useGlobalEslint'
      }, {
        old: 'globalNodePath',
        new: 'global.globalNodePath'
      }
    ]
  },
  {
    added: 'September, 2017',
    description: 'Deprecated eslintRulesDir{String} option in favor of eslintRulesDirs{Array<String>}',
    migrate(config) {
      const oldRulesdir = config.eslintRulesDir
      if (oldRulesdir) {
        const newRulesDirs = config.eslintRulesDirs
        if (newRulesDirs.length === 0) {
          atom.config.set('linter-eslint.eslintRulesDirs', [oldRulesdir])
        }
        atom.config.unset('linter-eslint.eslintRulesDir')
      }
    }
  }
]

/*
 * This function can be called when linter-eslint first activates in order to
 * ensure that the user's settings are up-to-date with the current version of
 * linter-eslint.  Ideally, we would call this only when upgrading to a new
 * version.
 */
function migrateConfigOptions(migrations = activeMigrations) {
  if (migrations.length) {
    const linterEslintConfig = atom.config.get('linter-eslint')
    migrations.forEach((migration) => {
      if (migration.moves && Array.isArray(migration.moves)) {
        // Copy old settings over to the new ones, then unset the old setting keys
        migration.moves.forEach((move) => {
          const oldSetting = linterEslintConfig[move.old]
          if (oldSetting !== undefined) {
            atom.config.set(`linter-eslint.${move.new}`, oldSetting)
            atom.config.unset(`linter-eslint.${move.old}`)
          }
        })
      } else if (typeof migration.migrate === 'function') {
        migration.migrate(linterEslintConfig)
      }
    })
  }
}

module.exports = migrateConfigOptions
