"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _eslintRuleDocumentation = _interopRequireDefault(require("eslint-rule-documentation"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Stores a list of rules from ESLint
 */
class Rules {
  /**
   * Instantiates a Rules object, optionally with an existing list of rules
   * @param {Array<Array<string, any>} newRules Array of Arrays of the rule and properties
   */
  constructor(newRules) {
    this.replaceRules(newRules);
  }
  /**
   * Process the updated rules into the local Map and call further update functions
   * @param  {Array<Array<string, any>} newRules Array of Arrays of the rule and properties
   */


  replaceRules(newRules) {
    if (this.rules !== undefined) {
      this.rules.clear();
    }
    /** @type {Map<string, any>} */


    this.rules = new Map(newRules);
  }
  /**
   * [getFixableRules description]
   * @return {Array<string>} The ruleIds of the currently known fixable rules
   */


  getFixableRules() {
    const ruleIds = []; // eslint-disable-next-line no-restricted-syntax

    for (const [ruleId, ruleProps] of this.rules) {
      if (ruleProps && ruleProps.meta && ruleProps.meta.fixable) {
        ruleIds.push(ruleId);
      }
    }

    return ruleIds;
  }
  /**
   * Get the URL of the documentation for a rule, either from the rule's own
   * metadata, from eslint-rule-documentation's known rules, or the fallback URL
   * on how to add it to eslint-rule-documentation.
   * @param  {string} ruleId The rule ID to get the documentation URL for
   * @return {string}        URL of the rule documentation
   */


  getRuleUrl(ruleId) {
    const props = this.rules.get(ruleId);

    if (props && props.meta && props.meta.docs && props.meta.docs.url) {
      // The rule has a documentation URL specified in its metadata
      return props.meta.docs.url;
    } // The rule didn't specify a URL in its metadata, or was not currently known
    // somehow. Attempt to determine a URL using eslint-rule-documentation.


    return (0, _eslintRuleDocumentation.default)(ruleId).url;
  }
  /**
   * Return the known rules.
   * @return {Map<string, any>} The currently known rules
   */


  getRules() {
    return this.rules;
  }

}

exports.default = Rules;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9ydWxlcy5qcyJdLCJuYW1lcyI6WyJSdWxlcyIsImNvbnN0cnVjdG9yIiwibmV3UnVsZXMiLCJyZXBsYWNlUnVsZXMiLCJydWxlcyIsInVuZGVmaW5lZCIsImNsZWFyIiwiTWFwIiwiZ2V0Rml4YWJsZVJ1bGVzIiwicnVsZUlkcyIsInJ1bGVJZCIsInJ1bGVQcm9wcyIsIm1ldGEiLCJmaXhhYmxlIiwicHVzaCIsImdldFJ1bGVVcmwiLCJwcm9wcyIsImdldCIsImRvY3MiLCJ1cmwiLCJnZXRSdWxlcyJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBOzs7O0FBRUE7QUFDQTtBQUNBO0FBQ2UsTUFBTUEsS0FBTixDQUFZO0FBQ3pCO0FBQ0Y7QUFDQTtBQUNBO0FBQ0VDLEVBQUFBLFdBQVcsQ0FBQ0MsUUFBRCxFQUFXO0FBQ3BCLFNBQUtDLFlBQUwsQ0FBa0JELFFBQWxCO0FBQ0Q7QUFFRDtBQUNGO0FBQ0E7QUFDQTs7O0FBQ0VDLEVBQUFBLFlBQVksQ0FBQ0QsUUFBRCxFQUFXO0FBQ3JCLFFBQUksS0FBS0UsS0FBTCxLQUFlQyxTQUFuQixFQUE4QjtBQUM1QixXQUFLRCxLQUFMLENBQVdFLEtBQVg7QUFDRDtBQUVEOzs7QUFDQSxTQUFLRixLQUFMLEdBQWEsSUFBSUcsR0FBSixDQUFRTCxRQUFSLENBQWI7QUFDRDtBQUVEO0FBQ0Y7QUFDQTtBQUNBOzs7QUFDRU0sRUFBQUEsZUFBZSxHQUFHO0FBQ2hCLFVBQU1DLE9BQU8sR0FBRyxFQUFoQixDQURnQixDQUVoQjs7QUFDQSxTQUFLLE1BQU0sQ0FBQ0MsTUFBRCxFQUFTQyxTQUFULENBQVgsSUFBa0MsS0FBS1AsS0FBdkMsRUFBOEM7QUFDNUMsVUFBSU8sU0FBUyxJQUFJQSxTQUFTLENBQUNDLElBQXZCLElBQStCRCxTQUFTLENBQUNDLElBQVYsQ0FBZUMsT0FBbEQsRUFBMkQ7QUFDekRKLFFBQUFBLE9BQU8sQ0FBQ0ssSUFBUixDQUFhSixNQUFiO0FBQ0Q7QUFDRjs7QUFDRCxXQUFPRCxPQUFQO0FBQ0Q7QUFFRDtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBQ0VNLEVBQUFBLFVBQVUsQ0FBQ0wsTUFBRCxFQUFTO0FBQ2pCLFVBQU1NLEtBQUssR0FBRyxLQUFLWixLQUFMLENBQVdhLEdBQVgsQ0FBZVAsTUFBZixDQUFkOztBQUNBLFFBQUlNLEtBQUssSUFBSUEsS0FBSyxDQUFDSixJQUFmLElBQXVCSSxLQUFLLENBQUNKLElBQU4sQ0FBV00sSUFBbEMsSUFBMENGLEtBQUssQ0FBQ0osSUFBTixDQUFXTSxJQUFYLENBQWdCQyxHQUE5RCxFQUFtRTtBQUNqRTtBQUNBLGFBQU9ILEtBQUssQ0FBQ0osSUFBTixDQUFXTSxJQUFYLENBQWdCQyxHQUF2QjtBQUNELEtBTGdCLENBT2pCO0FBQ0E7OztBQUNBLFdBQU8sc0NBQVFULE1BQVIsRUFBZ0JTLEdBQXZCO0FBQ0Q7QUFFRDtBQUNGO0FBQ0E7QUFDQTs7O0FBQ0VDLEVBQUFBLFFBQVEsR0FBRztBQUNULFdBQU8sS0FBS2hCLEtBQVo7QUFDRDs7QUE5RHdCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHJ1bGVVUkkgZnJvbSAnZXNsaW50LXJ1bGUtZG9jdW1lbnRhdGlvbidcblxuLyoqXG4gKiBTdG9yZXMgYSBsaXN0IG9mIHJ1bGVzIGZyb20gRVNMaW50XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFJ1bGVzIHtcbiAgLyoqXG4gICAqIEluc3RhbnRpYXRlcyBhIFJ1bGVzIG9iamVjdCwgb3B0aW9uYWxseSB3aXRoIGFuIGV4aXN0aW5nIGxpc3Qgb2YgcnVsZXNcbiAgICogQHBhcmFtIHtBcnJheTxBcnJheTxzdHJpbmcsIGFueT59IG5ld1J1bGVzIEFycmF5IG9mIEFycmF5cyBvZiB0aGUgcnVsZSBhbmQgcHJvcGVydGllc1xuICAgKi9cbiAgY29uc3RydWN0b3IobmV3UnVsZXMpIHtcbiAgICB0aGlzLnJlcGxhY2VSdWxlcyhuZXdSdWxlcylcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIHRoZSB1cGRhdGVkIHJ1bGVzIGludG8gdGhlIGxvY2FsIE1hcCBhbmQgY2FsbCBmdXJ0aGVyIHVwZGF0ZSBmdW5jdGlvbnNcbiAgICogQHBhcmFtICB7QXJyYXk8QXJyYXk8c3RyaW5nLCBhbnk+fSBuZXdSdWxlcyBBcnJheSBvZiBBcnJheXMgb2YgdGhlIHJ1bGUgYW5kIHByb3BlcnRpZXNcbiAgICovXG4gIHJlcGxhY2VSdWxlcyhuZXdSdWxlcykge1xuICAgIGlmICh0aGlzLnJ1bGVzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMucnVsZXMuY2xlYXIoKVxuICAgIH1cblxuICAgIC8qKiBAdHlwZSB7TWFwPHN0cmluZywgYW55Pn0gKi9cbiAgICB0aGlzLnJ1bGVzID0gbmV3IE1hcChuZXdSdWxlcylcbiAgfVxuXG4gIC8qKlxuICAgKiBbZ2V0Rml4YWJsZVJ1bGVzIGRlc2NyaXB0aW9uXVxuICAgKiBAcmV0dXJuIHtBcnJheTxzdHJpbmc+fSBUaGUgcnVsZUlkcyBvZiB0aGUgY3VycmVudGx5IGtub3duIGZpeGFibGUgcnVsZXNcbiAgICovXG4gIGdldEZpeGFibGVSdWxlcygpIHtcbiAgICBjb25zdCBydWxlSWRzID0gW11cbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tcmVzdHJpY3RlZC1zeW50YXhcbiAgICBmb3IgKGNvbnN0IFtydWxlSWQsIHJ1bGVQcm9wc10gb2YgdGhpcy5ydWxlcykge1xuICAgICAgaWYgKHJ1bGVQcm9wcyAmJiBydWxlUHJvcHMubWV0YSAmJiBydWxlUHJvcHMubWV0YS5maXhhYmxlKSB7XG4gICAgICAgIHJ1bGVJZHMucHVzaChydWxlSWQpXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBydWxlSWRzXG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBVUkwgb2YgdGhlIGRvY3VtZW50YXRpb24gZm9yIGEgcnVsZSwgZWl0aGVyIGZyb20gdGhlIHJ1bGUncyBvd25cbiAgICogbWV0YWRhdGEsIGZyb20gZXNsaW50LXJ1bGUtZG9jdW1lbnRhdGlvbidzIGtub3duIHJ1bGVzLCBvciB0aGUgZmFsbGJhY2sgVVJMXG4gICAqIG9uIGhvdyB0byBhZGQgaXQgdG8gZXNsaW50LXJ1bGUtZG9jdW1lbnRhdGlvbi5cbiAgICogQHBhcmFtICB7c3RyaW5nfSBydWxlSWQgVGhlIHJ1bGUgSUQgdG8gZ2V0IHRoZSBkb2N1bWVudGF0aW9uIFVSTCBmb3JcbiAgICogQHJldHVybiB7c3RyaW5nfSAgICAgICAgVVJMIG9mIHRoZSBydWxlIGRvY3VtZW50YXRpb25cbiAgICovXG4gIGdldFJ1bGVVcmwocnVsZUlkKSB7XG4gICAgY29uc3QgcHJvcHMgPSB0aGlzLnJ1bGVzLmdldChydWxlSWQpXG4gICAgaWYgKHByb3BzICYmIHByb3BzLm1ldGEgJiYgcHJvcHMubWV0YS5kb2NzICYmIHByb3BzLm1ldGEuZG9jcy51cmwpIHtcbiAgICAgIC8vIFRoZSBydWxlIGhhcyBhIGRvY3VtZW50YXRpb24gVVJMIHNwZWNpZmllZCBpbiBpdHMgbWV0YWRhdGFcbiAgICAgIHJldHVybiBwcm9wcy5tZXRhLmRvY3MudXJsXG4gICAgfVxuXG4gICAgLy8gVGhlIHJ1bGUgZGlkbid0IHNwZWNpZnkgYSBVUkwgaW4gaXRzIG1ldGFkYXRhLCBvciB3YXMgbm90IGN1cnJlbnRseSBrbm93blxuICAgIC8vIHNvbWVob3cuIEF0dGVtcHQgdG8gZGV0ZXJtaW5lIGEgVVJMIHVzaW5nIGVzbGludC1ydWxlLWRvY3VtZW50YXRpb24uXG4gICAgcmV0dXJuIHJ1bGVVUkkocnVsZUlkKS51cmxcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIGtub3duIHJ1bGVzLlxuICAgKiBAcmV0dXJuIHtNYXA8c3RyaW5nLCBhbnk+fSBUaGUgY3VycmVudGx5IGtub3duIHJ1bGVzXG4gICAqL1xuICBnZXRSdWxlcygpIHtcbiAgICByZXR1cm4gdGhpcy5ydWxlc1xuICB9XG59XG4iXX0=