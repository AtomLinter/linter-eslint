import ruleURI from 'eslint-rule-documentation'

/**
 * Stores a list of rules from ESLint
 */
export default class Rules {
  /**
   * Instantiates a Rules object, optionally with an existing list of rules
   * @param {Array} newRules Array of Arrays of the rule and properties
   */
  constructor(newRules) {
    this.rules = new Map()
    if (newRules) {
      this.updateRules(newRules)
    }
  }

  /**
   * Process the updated rules into the local Map and call further update functions
   * @param  {Array} updatedRules Array of Arrays of the rule and properties
   */
  updateRules(updatedRules) {
    this.rules.clear()
    updatedRules.forEach(([rule, props]) => this.rules.set(rule, props))
  }

  /**
   * [getFixableRules description]
   * @return {Array} The ruleIds of the currently known fixable rules
   */
  getFixableRules() {
    return Array.from(this.rules).reduce((fixable, [rule, props]) => {
      if (props.meta && props.meta.fixable) {
        return [...fixable, rule]
      }
      return fixable
    }, [])
  }

  /**
   * Get the URL of the documentation for a rule, either from the rule's own
   * metadata, from eslint-rule-documentation's known rules, or the fallback URL
   * on how to add it to eslint-rule-documentation.
   * @param  {String} ruleId The rule ID to get the documentation URL for
   * @return {String}        URL of the rule documentation
   */
  getRuleUrl(ruleId) {
    const props = this.rules.get(ruleId)
    if (props && props.meta && props.meta.docs && props.meta.docs.url) {
      // The rule has a documentation URL specified in its metadata
      return props.meta.docs.url
    }

    // The rule didn't specify a URL in its metadata, or was not currently known
    // somehow. Attempt to determine a URL using eslint-rule-documentation.
    return ruleURI(ruleId).url
  }

  /**
   * Return the known rules.
   * @return {Map} The currently known rules
   */
  getRules() {
    return new Map(this.rules)
  }
}
