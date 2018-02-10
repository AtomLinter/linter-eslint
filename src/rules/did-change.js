
/**
 * Given an exiting rule list and a new rule list, determines whether there
 * have been changes.
 * NOTE: This only accounts for presence of the rules, changes to their metadata
 * are not taken into account.
 * @param  {Map} newRules     A Map of the new rules
 * @param  {Map} currentRules A Map of the current rules
 * @return {boolean}             Whether or not there were changes
 */
const rulesDidChange = (currentRules, newRules) =>
  !(currentRules.size === newRules.size &&
    Array.from(currentRules.keys()).every(ruleId => newRules.has(ruleId)))

module.exports = rulesDidChange
