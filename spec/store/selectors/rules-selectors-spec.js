'use babel'

// eslint-disable-next-line no-unused-vars
import 'jasmine-fix'
import r from '../../../src/f-utils/mini-ramda'
import makeSpy from '../../make-spy'
import { keyedMap } from '../../../src/f-utils'
import {
  getRule,
  makeGetRulesDiff,
  getFixableRules,
  makeGetFixableAsIgnored,
  makeGetRuleUrl
} from '../../../src/store/selectors/rules'


describe('rules-selectors', () => {
  it('getRule retrieves a rule by ruleId', () => {
    const state = { a: { aProp: 10 }, b: { bProp: 12 } }
    const result = getRule(state, { ruleId: 'b' })
    expect(result).toEqual({ bProp: 12 })
  })

  it('getRulesDiff returns diff against rules in state', () => {
    const spy = makeSpy()
    const diff = spy.call

    const getRulesDiff = makeGetRulesDiff(diff)
    const state = { a: { aProp: 10 }, b: { bProp: 12 } }
    const rules = { a: { aProp: 10 } }

    const expectedCalledWith = [
      { a: { aProp: 10 }, b: { bProp: 12 } },
      { a: { aProp: 10 } }
    ]
    const returnVal = getRulesDiff(state, rules)

    expect(returnVal).toBe('called spy')
    expect(spy.calledWith[0]).toEqual(expectedCalledWith)
  })

  it('getFixableRules returns list of fixable rules', () => {
    const state = {
      a: { meta: { fixable: 'whitespace' } },
      b: { meta: { docs: {} } },
      c: { meta: { fixable: null } },
      d: { meta: { fixable: 'code' } },
      e: {}
    }
    const expected = {
      a: { meta: { fixable: 'whitespace' } },
      d: { meta: { fixable: 'code' } }
    }
    const fixable = getFixableRules(state)
    expect(fixable).toEqual(expected)
  })

  it('getFixableAsIgnored', () => {
    const state = {
      a: { isFixable: true },
      b: { isFixable: false },
      c: { isFixable: true },
    }
    // eslint-disable-next-line no-shadow
    const getFixableRules = makeSpy(r.filter(rule => rule.isFixable, state))
    const getFixableAsIgnored =
      makeGetFixableAsIgnored(getFixableRules.call)

    const result = getFixableAsIgnored(state)
    expect(getFixableRules.called()).toBeTruthy()
    expect(result).toEqual({ a: 0, c: 0 })
  })

  it('getRuleUrl', () => {
    const spy = makeSpy({ url: 'spy-url' })
    const getRuleUrl = makeGetRuleUrl(spy.call)
    const state = {
      a: { meta: { docs: { url: 'meta-url' } } },
      b: { meta: { docs: {} } },
      c: { meta: { docs: { url: null } } },
      d: {},
    }

    const results = keyedMap(
      (_, key) =>
        getRuleUrl(state, key)
      , state
    )

    expect(results.a).toBe('meta-url')
    expect(results.b).toBe('spy-url')
    expect(results.c).toBe('spy-url')
    expect(results.d).toBe('spy-url')

    expect(results)
  })
})
