'use babel'

import Rules from '../src/rules'

describe('The Rules class', () => {
  describe('replaceRules', () => {
    const ruleArray = [
      ['foo', { meta: { fixable: true } }],
      ['bar', { meta: {} }]
    ]

    it('adds new rules', () => {
      const rules = new Rules()
      expect(rules.getRules()).toEqual(new Map())
      rules.replaceRules(ruleArray)
      expect(rules.getRules()).toEqual(new Map(ruleArray))
    })

    it('removes old rules', () => {
      const rules = new Rules()
      rules.replaceRules(ruleArray)
      expect(rules.getRules()).toEqual(new Map(ruleArray))
      rules.replaceRules([])
      expect(rules.getRules()).toEqual(new Map())
    })

    it('updates the fixableRules list', () => {
      const rules = new Rules()
      expect(rules.getFixableRules()).toEqual([])
      rules.replaceRules(ruleArray)
      expect(rules.getFixableRules()).toEqual(['foo'])
    })
  })

  describe('getRuleUrl', () => {
    it('works with rules that define their own URL', () => {
      const rules = new Rules()
      rules.replaceRules([['foo', { meta: { docs: { url: 'bar' } } }]])
      expect(rules.getRuleUrl('foo')).toBe('bar')
    })

    it('works with rules defined in eslint-rule-documentation', () => {
      const rules = new Rules()
      const url = 'https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-duplicates.md'
      expect(rules.getRuleUrl('import/no-duplicates')).toBe(url)
    })

    it('gives a fallback URL on how to add a rule URL', () => {
      const rules = new Rules()
      const url = 'https://github.com/jfmengels/eslint-rule-documentation/blob/master/contributing.md'
      expect(rules.getRuleUrl('foo/bar')).toBe(url)
    })
  })
})
