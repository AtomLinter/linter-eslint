'use babel'

// eslint-disable-next-line no-unused-vars
import 'jasmine-fix'
import makeSpy from '../../make-spy'
import { fromObjToMap } from '../../../src/f-utils'
import { replaceRules, updateRules, makeDiffRules } from '../../../src/store/actions/rules'
import { rules as actions } from '../../../src/store/actions'

const { REPLACE, UPDATE } = actions


describe('rules action symbols', () => {
  it('holds expected value for REPLACE symbol', () => {
    expect(REPLACE.constructor).toBe(Symbol)
    expect(REPLACE.toString()).toBe('Symbol(replace rules)')
  })
  it('holds expected value for UPDATE symbol', () => {
    expect(UPDATE.constructor).toBe(Symbol)
    expect(UPDATE.toString()).toBe('Symbol(update rules)')
  })
})


describe('replaceRules action creator', () => {
  it('returns a REPLACE action when given an object', () => {
    const rules = { rule1: { prop: 'value' } }
    const action = replaceRules(rules)
    expect(action).toEqual({
      type: REPLACE,
      rules: { rule1: { prop: 'value' } }
    })
  })

  it('returns a REPLACE action when given a Map', () => {
    const rulesObj = { rule2: { prop: 'value' } }
    const rules = fromObjToMap(rulesObj)
    const action = replaceRules(rules)
    expect(action).toEqual({
      type: REPLACE,
      rules: { rule2: { prop: 'value' } }
    })
  })
})


describe('updateRules action creator', () => {
  it('returns an UPDATE action when given an object', () => {
    const diff = {
      added: { prop1: {} },
      removed: { prop2: {} },
      modified: { prop3: {} }
    }
    const action = updateRules(diff)
    expect(action).toEqual({
      type: UPDATE,
      changes: {
        added: { prop1: {} },
        removed: { prop2: {} },
        modified: { prop3: {} }
      }
    })
  })
})


// TODO need test case for empty diff
//
describe('diffRules action creator', () => {
  it('returns a thunk that diffs and maybe dispatches UPDATE', () => {
    const rulesObj = { rule2: { prop: 'value' } }
    const rules = fromObjToMap(rulesObj)

    const replace = makeSpy('replace')
    const getDiff = makeSpy({ added: { ...rulesObj } })
    const dispatch = makeSpy()
    const getState = makeSpy({})

    const diffRules = makeDiffRules(replace.call, getDiff.call)
    const thunk = diffRules(rules)
    const result = thunk(dispatch.call, getState.call)

    const expectedDiff = {
      added: { rule2: { prop: 'value' } }
    }

    expect(replace.calledWith[0][0]).toEqual(expectedDiff)
    expect(dispatch.calledWith[0][0]).toBe('replace')
    expect(result).toEqual(expectedDiff)
  })
})
