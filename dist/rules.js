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
   * @param {Array<Array<string, any> | undefined} newRules Array of Arrays of the rule and properties
   */
  constructor(newRules) {
    // TODO we should not accept undefined newRules.
    this.replaceRules(newRules);
  }
  /**
   * Process the updated rules into the local Map and call further update functions
   * @param  {Array<Array<string, any> | undefined} newRules Array of Arrays of the rule and properties
   */


  replaceRules(newRules) {
    if (this.rules !== undefined) {
      this.rules.clear();
    }
    /** @type {Map<string, any>} if newRules is {undefined} an empty Map is created */


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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9ydWxlcy5qcyJdLCJuYW1lcyI6WyJSdWxlcyIsImNvbnN0cnVjdG9yIiwibmV3UnVsZXMiLCJyZXBsYWNlUnVsZXMiLCJydWxlcyIsInVuZGVmaW5lZCIsImNsZWFyIiwiTWFwIiwiZ2V0Rml4YWJsZVJ1bGVzIiwicnVsZUlkcyIsInJ1bGVJZCIsInJ1bGVQcm9wcyIsIm1ldGEiLCJmaXhhYmxlIiwicHVzaCIsImdldFJ1bGVVcmwiLCJwcm9wcyIsImdldCIsImRvY3MiLCJ1cmwiLCJnZXRSdWxlcyJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBOzs7O0FBRUE7QUFDQTtBQUNBO0FBQ2UsTUFBTUEsS0FBTixDQUFZO0FBQ3pCO0FBQ0Y7QUFDQTtBQUNBO0FBQ0VDLEVBQUFBLFdBQVcsQ0FBQ0MsUUFBRCxFQUFXO0FBQ3BCO0FBQ0EsU0FBS0MsWUFBTCxDQUFrQkQsUUFBbEI7QUFDRDtBQUVEO0FBQ0Y7QUFDQTtBQUNBOzs7QUFDRUMsRUFBQUEsWUFBWSxDQUFDRCxRQUFELEVBQVc7QUFDckIsUUFBSSxLQUFLRSxLQUFMLEtBQWVDLFNBQW5CLEVBQThCO0FBQzVCLFdBQUtELEtBQUwsQ0FBV0UsS0FBWDtBQUNEO0FBRUQ7OztBQUNBLFNBQUtGLEtBQUwsR0FBYSxJQUFJRyxHQUFKLENBQVFMLFFBQVIsQ0FBYjtBQUNEO0FBRUQ7QUFDRjtBQUNBO0FBQ0E7OztBQUNFTSxFQUFBQSxlQUFlLEdBQUc7QUFDaEIsVUFBTUMsT0FBTyxHQUFHLEVBQWhCLENBRGdCLENBRWhCOztBQUNBLFNBQUssTUFBTSxDQUFDQyxNQUFELEVBQVNDLFNBQVQsQ0FBWCxJQUFrQyxLQUFLUCxLQUF2QyxFQUE4QztBQUM1QyxVQUFJTyxTQUFTLElBQUlBLFNBQVMsQ0FBQ0MsSUFBdkIsSUFBK0JELFNBQVMsQ0FBQ0MsSUFBVixDQUFlQyxPQUFsRCxFQUEyRDtBQUN6REosUUFBQUEsT0FBTyxDQUFDSyxJQUFSLENBQWFKLE1BQWI7QUFDRDtBQUNGOztBQUNELFdBQU9ELE9BQVA7QUFDRDtBQUVEO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFDRU0sRUFBQUEsVUFBVSxDQUFDTCxNQUFELEVBQVM7QUFDakIsVUFBTU0sS0FBSyxHQUFHLEtBQUtaLEtBQUwsQ0FBV2EsR0FBWCxDQUFlUCxNQUFmLENBQWQ7O0FBQ0EsUUFBSU0sS0FBSyxJQUFJQSxLQUFLLENBQUNKLElBQWYsSUFBdUJJLEtBQUssQ0FBQ0osSUFBTixDQUFXTSxJQUFsQyxJQUEwQ0YsS0FBSyxDQUFDSixJQUFOLENBQVdNLElBQVgsQ0FBZ0JDLEdBQTlELEVBQW1FO0FBQ2pFO0FBQ0EsYUFBT0gsS0FBSyxDQUFDSixJQUFOLENBQVdNLElBQVgsQ0FBZ0JDLEdBQXZCO0FBQ0QsS0FMZ0IsQ0FPakI7QUFDQTs7O0FBQ0EsV0FBTyxzQ0FBUVQsTUFBUixFQUFnQlMsR0FBdkI7QUFDRDtBQUVEO0FBQ0Y7QUFDQTtBQUNBOzs7QUFDRUMsRUFBQUEsUUFBUSxHQUFHO0FBQ1QsV0FBTyxLQUFLaEIsS0FBWjtBQUNEOztBQS9Ed0IiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcnVsZVVSSSBmcm9tICdlc2xpbnQtcnVsZS1kb2N1bWVudGF0aW9uJ1xuXG4vKipcbiAqIFN0b3JlcyBhIGxpc3Qgb2YgcnVsZXMgZnJvbSBFU0xpbnRcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUnVsZXMge1xuICAvKipcbiAgICogSW5zdGFudGlhdGVzIGEgUnVsZXMgb2JqZWN0LCBvcHRpb25hbGx5IHdpdGggYW4gZXhpc3RpbmcgbGlzdCBvZiBydWxlc1xuICAgKiBAcGFyYW0ge0FycmF5PEFycmF5PHN0cmluZywgYW55PiB8IHVuZGVmaW5lZH0gbmV3UnVsZXMgQXJyYXkgb2YgQXJyYXlzIG9mIHRoZSBydWxlIGFuZCBwcm9wZXJ0aWVzXG4gICAqL1xuICBjb25zdHJ1Y3RvcihuZXdSdWxlcykge1xuICAgIC8vIFRPRE8gd2Ugc2hvdWxkIG5vdCBhY2NlcHQgdW5kZWZpbmVkIG5ld1J1bGVzLlxuICAgIHRoaXMucmVwbGFjZVJ1bGVzKG5ld1J1bGVzKVxuICB9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgdGhlIHVwZGF0ZWQgcnVsZXMgaW50byB0aGUgbG9jYWwgTWFwIGFuZCBjYWxsIGZ1cnRoZXIgdXBkYXRlIGZ1bmN0aW9uc1xuICAgKiBAcGFyYW0gIHtBcnJheTxBcnJheTxzdHJpbmcsIGFueT4gfCB1bmRlZmluZWR9IG5ld1J1bGVzIEFycmF5IG9mIEFycmF5cyBvZiB0aGUgcnVsZSBhbmQgcHJvcGVydGllc1xuICAgKi9cbiAgcmVwbGFjZVJ1bGVzKG5ld1J1bGVzKSB7XG4gICAgaWYgKHRoaXMucnVsZXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5ydWxlcy5jbGVhcigpXG4gICAgfVxuXG4gICAgLyoqIEB0eXBlIHtNYXA8c3RyaW5nLCBhbnk+fSBpZiBuZXdSdWxlcyBpcyB7dW5kZWZpbmVkfSBhbiBlbXB0eSBNYXAgaXMgY3JlYXRlZCAqL1xuICAgIHRoaXMucnVsZXMgPSBuZXcgTWFwKG5ld1J1bGVzKVxuICB9XG5cbiAgLyoqXG4gICAqIFtnZXRGaXhhYmxlUnVsZXMgZGVzY3JpcHRpb25dXG4gICAqIEByZXR1cm4ge0FycmF5PHN0cmluZz59IFRoZSBydWxlSWRzIG9mIHRoZSBjdXJyZW50bHkga25vd24gZml4YWJsZSBydWxlc1xuICAgKi9cbiAgZ2V0Rml4YWJsZVJ1bGVzKCkge1xuICAgIGNvbnN0IHJ1bGVJZHMgPSBbXVxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1yZXN0cmljdGVkLXN5bnRheFxuICAgIGZvciAoY29uc3QgW3J1bGVJZCwgcnVsZVByb3BzXSBvZiB0aGlzLnJ1bGVzKSB7XG4gICAgICBpZiAocnVsZVByb3BzICYmIHJ1bGVQcm9wcy5tZXRhICYmIHJ1bGVQcm9wcy5tZXRhLmZpeGFibGUpIHtcbiAgICAgICAgcnVsZUlkcy5wdXNoKHJ1bGVJZClcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJ1bGVJZHNcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIFVSTCBvZiB0aGUgZG9jdW1lbnRhdGlvbiBmb3IgYSBydWxlLCBlaXRoZXIgZnJvbSB0aGUgcnVsZSdzIG93blxuICAgKiBtZXRhZGF0YSwgZnJvbSBlc2xpbnQtcnVsZS1kb2N1bWVudGF0aW9uJ3Mga25vd24gcnVsZXMsIG9yIHRoZSBmYWxsYmFjayBVUkxcbiAgICogb24gaG93IHRvIGFkZCBpdCB0byBlc2xpbnQtcnVsZS1kb2N1bWVudGF0aW9uLlxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IHJ1bGVJZCBUaGUgcnVsZSBJRCB0byBnZXQgdGhlIGRvY3VtZW50YXRpb24gVVJMIGZvclxuICAgKiBAcmV0dXJuIHtzdHJpbmd9ICAgICAgICBVUkwgb2YgdGhlIHJ1bGUgZG9jdW1lbnRhdGlvblxuICAgKi9cbiAgZ2V0UnVsZVVybChydWxlSWQpIHtcbiAgICBjb25zdCBwcm9wcyA9IHRoaXMucnVsZXMuZ2V0KHJ1bGVJZClcbiAgICBpZiAocHJvcHMgJiYgcHJvcHMubWV0YSAmJiBwcm9wcy5tZXRhLmRvY3MgJiYgcHJvcHMubWV0YS5kb2NzLnVybCkge1xuICAgICAgLy8gVGhlIHJ1bGUgaGFzIGEgZG9jdW1lbnRhdGlvbiBVUkwgc3BlY2lmaWVkIGluIGl0cyBtZXRhZGF0YVxuICAgICAgcmV0dXJuIHByb3BzLm1ldGEuZG9jcy51cmxcbiAgICB9XG5cbiAgICAvLyBUaGUgcnVsZSBkaWRuJ3Qgc3BlY2lmeSBhIFVSTCBpbiBpdHMgbWV0YWRhdGEsIG9yIHdhcyBub3QgY3VycmVudGx5IGtub3duXG4gICAgLy8gc29tZWhvdy4gQXR0ZW1wdCB0byBkZXRlcm1pbmUgYSBVUkwgdXNpbmcgZXNsaW50LXJ1bGUtZG9jdW1lbnRhdGlvbi5cbiAgICByZXR1cm4gcnVsZVVSSShydWxlSWQpLnVybFxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUga25vd24gcnVsZXMuXG4gICAqIEByZXR1cm4ge01hcDxzdHJpbmcsIGFueT59IFRoZSBjdXJyZW50bHkga25vd24gcnVsZXNcbiAgICovXG4gIGdldFJ1bGVzKCkge1xuICAgIHJldHVybiB0aGlzLnJ1bGVzXG4gIH1cbn1cbiJdfQ==