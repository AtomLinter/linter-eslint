'use babel'

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
import configs from './config-mappings'
import addDerivedGetters from './derived'
import { setValue } from './make-handler'

// idleCallback setup for migrating any old config settings
//
export { default as getMigrations } from './migrate'

// Object to store known config settings
//
export const atomConfig = {
  // Add objects/arrays up-front to establish pointers.
  scopes: [],
  ignoredRulesWhenModified: [],
  ignoredRulesWhenFixing: {},
  // Embedded scope stored here for convenienct access in handlers.
  embeddedScope: 'source.js.embedded.html',
}

addDerivedGetters(atomConfig)

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

export const subscribe = getAtomConfigSubscriptions
export { default as jobConfig } from './job-config'
