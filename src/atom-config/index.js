'use babel'

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
import { CompositeDisposable } from 'atom'
import configs from './config-mappings'
import { setValue } from './make-handler'
import requestMigration from './migrate'

// set idleCallbacks to migrate any old config settings
requestMigration()


// Object to store known config settings
//
export const atomConfig = {
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

// Add a disposable to a composite disposable.
//
const composite = (compSubs, sub) => {
  compSubs.add(sub)
  return compSubs
}

// Subscribe to known config settings and store disposables in composite
//
const getAtomConfigSubscriptions = () => configs //   Array<config mappings>
  .map(subscribeTo) //                             -> Array<disposables>
  .reduce(composite, new CompositeDisposable()) // -> compositeDisposable

export const subscribe = getAtomConfigSubscriptions
export { default as jobConfig } from './job-config'
