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

  describe('getRuleUrl', () => {
    it('works with rules that define their own URL', () => {
      Helpers.updateRules([['foo', { meta: { docs: { url: 'bar' } } }]])
      expect(Helpers.getRuleUrl('foo')).toBe('bar')
    })

    it('works with rules defined in eslint-rule-documentation', () => {
      const url = 'https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-duplicates.md'
      expect(Helpers.getRuleUrl('import/no-duplicates')).toBe(url)
    })

    it('gives a fallback URL on how to add a rule URL', () => {
      const url = 'https://github.com/jfmengels/eslint-rule-documentation/blob/master/contributing.md'
      expect(Helpers.getRuleUrl('foo/bar')).toBe(url)
    })
  })
})
