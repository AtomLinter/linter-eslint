'use babel'

import { createSelector } from 'reselect'
import ruleDocURIs from 'eslint-rule-documentation'
import r from '../../f-utils/mini-ramda'
import { deepProp } from '../../f-utils'
import * as rules from './rules'
import diffDict from '../../f-utils/deep-diff-dict'


// Grab any arbitrary property from the state tree with
// simple string representation { deepKey: 'some.deep.prop' }
// or null if does not exist.
//
export const selectDeepProp = createSelector(
  (state, { deepKey }) => deepProp(deepKey, state),
  r.identity
)

// A helper to reduce boilerplate of statically declaring branch
// selectors at the root level. Calls the given selector with
// only the portion of the state tree assiged to the named stateProp.
//
export const passDownBranchState = stateProp => selector => (state, ...args) =>
  selector(state[stateProp], ...args)


/**
 * Rules selectors
 */

const passToRules = passDownBranchState('rules')

export const getRules = state => state.rules
export const getRule = passToRules(rules.getRule)
export const getRulesDiff = passToRules(rules.makeGetRulesDiff(diffDict))
export const getFixableRules = passToRules(rules.getFixableRules)
export const getRuleUrl = passToRules(rules.makeGetRuleUrl(ruleDocURIs))

// TODO Once user settings are added to data store, merge this with
// rules from ignoredRulesWhenModified.
export const getFixableAsIgnored = passToRules(rules.makeGetFixableAsIgnored(rules.getFixableRules))
