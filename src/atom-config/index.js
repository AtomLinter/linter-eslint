
const rPick = require('ramda/src/pick')
const configs = require('./config-mappings')
const { setValue } = require('./make-handler')

// Object to store known config settings
//
const atomConfig = {
  // Add objects/arrays up-front to establish pointers.
  scopes: [],
  ignoredRulesWhenModified: [],
  ignoredRulesWhenFixing: {},
  // Embedded scope stored here for convenienct access in handlers.
  embeddedScope: 'source.js.embedded.html'
}

// Subscribe to any updates for a specific setting.
//
const subscribeTo = ({ appVarName, pkgJsonName, makeHandler = setValue }) =>
  atom.config.observe(
    // Listen for setting changes
    `linter-eslint.${pkgJsonName || appVarName}`,
    // Create handler with config and setting name
    makeHandler(atomConfig, appVarName)
  )

// Subscribe to known config settings and return as Array<disposables>
//
const getAtomConfigSubscriptions = () =>
  configs.map(subscribeTo)

// Current config filtered to what is needed by a lint job or fix job
//
const jobConfig = () => rPick([
  'disableFSCache',
  'disableWhenNoEslintConfig',
  'useGlobalEslint',
  'globalNodePath',
  'advancedLocalNodeModules',
  'disableEslintIgnore',
  'eslintRulesDirs',
  'eslintrcPath'
], atomConfig)

module.exports = {
  atomConfig,
  subscribe: getAtomConfigSubscriptions,
  jobConfig,
  // idleCallback setup for migrating any old config settings
  getMigrations: require('./migrate'),
}
