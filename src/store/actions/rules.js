'use babel'

import { rules as actions } from './'
import { fromMapToObj } from '../../f-utils'
import { getRulesDiff } from '../selectors'

const { UPDATE, REPLACE } = actions


export const replaceRules = (rules) => {
  const rulesObj = rules instanceof Map
    ? fromMapToObj(rules)
    : rules
  return {
    type: REPLACE,
    rules: rulesObj
  }
}


export const updateRules = changes => ({
  type: UPDATE,
  changes
})


export const makeDiffRules = (update, getDiff) => rules => (dispatch, getState) => {
  const rulesObj = rules instanceof Map
    ? fromMapToObj(rules)
    : rules
  const diff = getDiff(getState(), rulesObj)

  if (Object.keys(diff).length) { dispatch(update(diff)) }

  return diff
}

export const diffRules = makeDiffRules(updateRules, getRulesDiff)
