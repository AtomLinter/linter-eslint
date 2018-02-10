
const ruleURI = require('eslint-rule-documentation')
const reduce = require('ramda/src/reduce')

// Private properties
const rules = Symbol('rules')

/**
 * Stores a list of rules from ESLint
 */
module.exports = class Rules {
  /**
   * Instantiates a Rules object, optionally with an existing list of rules
   * @param {Array} newRules Array of Arrays of the rule and properties
   */
  constructor(newRules) {
    this.replaceRules(newRules)
    this[rules] = new Map()
  }

  /**
   * Process the updated rules into the local Map and call further update functions
   * @param  {Array} newRules Array of Arrays of the rule and properties
   */
  replaceRules(newRules) {
    this[rules] = new Map(newRules)
  }

  /**
   * Updated rules based on diff object
   * @param {Object} added  List of added rules
   * @param {Object} removed List of removed rules
   */
  updateRules({ added = {}, removed = {} } = {}) {
    Object.keys(removed)
      .forEach(k => this[rules].delete(k))
    Object.keys(added)
      .forEach(k => this[rules].set(k, added[k]))
    return this[rules]
  }

  /**
   * [getFixableRules description]
   * @return {Array} The ruleIds of the currently known fixable rules
   */
  getFixableRules() {
    return reduce((fixable, [ruleId, props]) => {
      if (props && props.meta && props.meta.fixable) {
        return [...fixable, ruleId]
      }
      return fixable
    }, [], this[rules])
  }

  /**
   *Transform Array or Iiterable containing list of Rule IDs, to Object
   * dictionary with Rule ID as key and 0 as values. This format will
   *  disable these rules when used in ESLint configuration.
   * @param  {[iterable]} ruleIds Iterable containing ruleIds to ignore
   * @return {Object}             Dictionary of disabled rules
   */
  // eslint-disable-next-line class-methods-use-this
  toIgnored(ruleIds) {
    return reduce(
      (disabled, id) =>
      // 0 is the severity to turn off a rule
        Object.assign(disabled, { [id]: 0 })
      , {}, ruleIds
    )
  }

  /**
   * Get an Object dictionary with Rule IDs as the key and all 0 values.
   *  Includes known fixable rules and any additional rules provided.
   * @param  {Array}  [ruleIds=[]] List of additional rules to ignore
   * @return {Object}              Dictionary of disabled rules.
   */
  getIgnoredRules(ruleIds = []) {
    return this.toIgnored(new Set([
      ...this.getFixableRules(),
      ...ruleIds
    ]))
  }

  /**
   * Get the URL of the documentation for a rule, either from the rule's own
   * metadata, from eslint-rule-documentation's known rules, or the fallback URL
   * on how to add it to eslint-rule-documentation.
   * @param  {String} ruleId The rule ID to get the documentation URL for
   * @return {String}        URL of the rule documentation
   */
  getRuleUrl(ruleId) {
    const props = this[rules].get(ruleId)
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
    return new Map(this[rules])
  }
}
