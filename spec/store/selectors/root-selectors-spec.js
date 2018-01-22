'use babel'

// eslint-disable-next-line no-unused-vars
import 'jasmine-fix'
import {
  selectDeepProp,
  passDownBranchState
} from '../../../src/store/selectors'

// TODO For Code coverage, would be nice to test the plumbing on all root
// level selectors that pass down to branch selectors.

describe('selectDeepProp', () => {
  it('returns a deep prop from given state', () => {
    const state = { a: { b: { c: { d: { e: 'value' }, f: {} }, g: {} } } }
    const value = selectDeepProp(state, { deepKey: 'a.b.c.d.e' })
    expect(value).toBe('value')
  })
})


describe('passDownBranchState', () => {
  it('passes a defined piece of state to a selector', () => {
    const selector = (state, { prop }) => state[prop]
    const state = {
      child1: { someProp: 'value 1' },
      child2: { someProp: 'value 2' }
    }
    const passToChild2 = passDownBranchState('child2')
    const child2Prop = passToChild2(selector)
    const child2SomeProp = child2Prop(state, { prop: 'someProp' })
    expect(child2SomeProp).toBe('value 2')
  })
})
