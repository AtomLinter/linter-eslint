'use babel'

// Only 1 migration right now, so keep it simple and in one file.

const migrateRulesDir = () => {
  const oldRulesdir = atom.config.get('linter-eslint.eslintRulesDir')
  if (oldRulesdir) {
    const rulesDirs = atom.config.get('linter-eslint.eslintRulesDirs')
    if (rulesDirs.length === 0) {
      atom.config.set('linter-eslint.eslintRulesDirs', [oldRulesdir])
    }
    atom.config.unset('linter-eslint.eslintRulesDir')
  }
}

const migrate = () => {
  window.requestIdleCallback(migrateRulesDir)
}

export default migrate
