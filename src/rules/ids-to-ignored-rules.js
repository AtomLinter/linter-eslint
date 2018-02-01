'use babel'

/**
 * Given an Array or iterable containing a list of Rule IDs, return an Object
 * to be sent to ESLint's configuration that disables those rules.
 * @param  {[iterable]} ruleIds Iterable containing ruleIds to ignore
 * @return {Object}             Object containing properties for each rule to ignore
 */
const idsToIgnoredRules = ruleIds =>
  Array.from(ruleIds).reduce(
    // 0 is the severity to turn off a rule
    (ids, id) => Object.assign(ids, { [id]: 0 })
    , {}
  )

export default idsToIgnoredRules
