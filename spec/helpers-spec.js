'use babel'

import * as Helpers from '../src/helpers'

describe('The helper module', () => {
  describe('updateRules', () => {
    const ruleArray = [
      ['foo', { meta: { fixable: true } }],
      ['bar', { meta: {} }]
    ]

    it('adds new rules', () => {
      expect(Helpers.getRules()).toEqual(new Map())
      Helpers.updateRules(ruleArray)
      expect(Helpers.getRules()).toEqual(new Map(ruleArray))
    })

    it('removes old rules', () => {
      Helpers.updateRules(ruleArray)
      expect(Helpers.getRules()).toEqual(new Map(ruleArray))
      Helpers.updateRules([])
      expect(Helpers.getRules()).toEqual(new Map())
    })

    it('updates the fixableRules list', () => {
      expect(Helpers.getFixableRules()).toEqual([])
      Helpers.updateRules(ruleArray)
      expect(Helpers.getFixableRules()).toEqual(['foo'])
    })
  })
})
