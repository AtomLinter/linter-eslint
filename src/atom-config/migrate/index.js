'use babel'

const migrations = [
  {
    migrate: () => {
      const oldRulesdir = atom.config.get('linter-eslint.eslintRulesDir')
      if (oldRulesdir) {
        const rulesDirs = atom.config.get('linter-eslint.eslintRulesDirs')
        if (rulesDirs.length === 0) {
          atom.config.set('linter-eslint.eslintRulesDirs', [oldRulesdir])
        }
        atom.config.unset('linter-eslint.eslintRulesDir')
      }
    }
  }
]

const migrate = () => migrations.map(migration => migration.migrate)

export default migrate
