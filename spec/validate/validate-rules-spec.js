'use babel'

import 'jasmine-fix'
import { isValidRuleType } from '../../src/validate/rules'

describe('isValidRuleType', () => {
  it('returns false for invalid types for rules', () => {
    expect(isValidRuleType(undefined)).toBe(false)
    expect(isValidRuleType(null)).toBe(false)
    expect(isValidRuleType([])).toBe(false)
  })
  it('returns true for valid types for rules', () => {
    // minimum requirement is to be a plain object
    // so only 1 check needed here
    expect(isValidRuleType({})).toBe(true)
  })
})
