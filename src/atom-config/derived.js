'use babel'

import rules from '../rules'

// Derive user-ignored rules formatted as an ESLint rules list
// combined (if enabled) with known fixable rules.
//
const ignoredRulesWhileTyping = config => () => {
  const {
    ignoreFixableRulesWhileTyping: ignoreFixEnabled,
    ignoredRulesWhenModified: alwaysIgnored
  } = config

  return ignoreFixEnabled
    ? rules().getIgnoredRules(alwaysIgnored)
    : rules().toIgnored(alwaysIgnored)
}

const derived = {
  ignoredRulesWhileTyping
}

// Partially apply the config object to each of the selectors
// and assign as a getter on config.
//
const addDerived = config => Object.keys(derived)
  .forEach(key => Object.defineProperty(config, key, {
    get: derived[key](config)
  }))

export default addDerived
