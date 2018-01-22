'use babel'

// allow explicityly not using a variable by starting with underscore
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */

import { createSelector } from 'reselect'
import { deepProp, isNotNil } from '../../f-utils'
import r from '../../f-utils/mini-ramda'

export const getRule = (state, { ruleId }) => r.prop(ruleId, state)

export const makeGetRulesDiff = diff => createSelector(
  (state, rules) => diff(state, rules),
  r.identity
)

// Find fixable props and filter out nils
export const getFixableRules = createSelector(
  r.map(rule => deepProp('meta.fixable', rule) && rule),
  r.filter(isNotNil)
)

export const makeGetFixableAsIgnored = getFixable => createSelector(
  getFixable,
  r.map(() => 0)
)

// Not using reselect for getRuleUrl because reselect's cache size is only
// 1 result, making memoization useless since almost never calling with
// same ruleId twice in a row.
//
// If this becomes a bottleneck, we should be able to write a customized
// version of createSelector that memoizes each ruleId separately. This
// github comment looks like a promising starting point:
//
// https://github.com/reactjs/reselect/issues/100#issuecomment-298696269
//
export const makeGetRuleUrl = ruleDocURIs =>
  (state, ruleId) => {
    const urlFromMeta = r.pipe(getRule, deepProp('meta.docs.url'))
    // try to find url in rule's own meta first
    return urlFromMeta(state, { ruleId })
    // otherwise lookup with id in eslint-rule-documentation
      || ruleDocURIs(ruleId).url
  }
