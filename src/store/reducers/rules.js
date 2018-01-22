'use babel'

import r from '../../f-utils/mini-ramda'
import { keyedFilter, isUndef } from '../../f-utils'
import { isValidRuleType } from '../../validate/rules'
import { rules as actions } from '../actions'

const { UPDATE, REPLACE } = actions


const replace = ({ rules }) => r.filter(isValidRuleType)(rules)

const update = (state, {
  changes: {
    added = {},
    removed = {}
  } = {}
} = {}) => ({
  ...keyedFilter((_, key) => isUndef(removed[key]), state),
  ...r.filter(isValidRuleType, added)
})


const rulesReducer = (state = {}, action = {}) => {
  switch (action.type) {
    case REPLACE: return replace(action)
    case UPDATE: return update(state, action)
    default: return state
  }
}

export default rulesReducer
