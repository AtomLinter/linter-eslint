'use babel'

// eslint-disable-next-line import/prefer-default-export
export const isValidRuleType = rule =>
  typeof rule === 'object'
    && rule !== null
    && !Array.isArray(rule)
