import ruleURI from 'eslint-rule-documentation'

/**
 * Stores a list of rules from ESLint
 */
export default class Rules {
  /**
   * Instantiates a Rules object, optionally with an existing list of rules
   * @param {Array<Array<string, any>} newRules Array of Arrays of the rule and properties
   */
  constructor(newRules) {
    this.replaceRules(newRules)
  }

  /**
   * Process the updated rules into the local Map and call further update functions
   * @param  {Array<Array<string, any>} newRules Array of Arrays of the rule and properties
   */
  replaceRules(newRules) {
    if (this.rules !== undefined) {
      this.rules.clear()
    }

    /** @type {Map<string, any>} */
    this.rules = new Map(newRules)
  }

  /**
   * [getFixableRules description]
   * @return {Array<string>} The ruleIds of the currently known fixable rules
   */
  getFixableRules() {
    const ruleIds = []
    // eslint-disable-next-line no-restricted-syntax
    for (const [ruleId, ruleProps] of this.rules) {
      if (ruleProps && ruleProps.meta && ruleProps.meta.fixable) {
        ruleIds.push(ruleId)
      }
    }
    return ruleIds
  }

  /**
   * Get the URL of the documentation for a rule, either from the rule's own
   * metadata, from eslint-rule-documentation's known rules, or the fallback URL
   * on how to add it to eslint-rule-documentation.
   * @param  {string} ruleId The rule ID to get the documentation URL for
   * @return {string}        URL of the rule documentation
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
   * @return {Map<string, any>} The currently known rules
   */
  getRules() {
    return this.rules
  }
}
