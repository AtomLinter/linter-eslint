'use babel'

import { join } from 'path'
import {
  findESLintDirectory,
  getESLintInstance,
  getRules,
  didRulesChange
} from '../src/worker/helpers'

const getFixturesPath = (...names) => join(__dirname, 'fixtures', ...names)

const globalNodePath = process.platform === 'win32' ?
  getFixturesPath('global-eslint', 'lib') :
  getFixturesPath('global-eslint')

describe('Worker Helpers', () => {
  describe('findESLintDirectory', () => {
    it('returns an object with path and type keys', () => {
      const modulesDir = getFixturesPath('local-eslint', 'node_modules')
      const foundEslint = findESLintDirectory({ modulesDir })
      expect(typeof foundEslint === 'object').toBe(true)
      expect(foundEslint.path).toBeDefined()
      expect(foundEslint.type).toBeDefined()
    })

    it('finds a local eslint when useGlobalEslint is false', () => {
      const modulesDir = getFixturesPath('local-eslint', 'node_modules')
      const foundEslint = findESLintDirectory({
        modulesDir,
        useGlobalEslint: false
      })
      const expectedEslintPath = getFixturesPath('local-eslint', 'node_modules', 'eslint')
      expect(foundEslint.path).toEqual(expectedEslintPath)
      expect(foundEslint.type).toEqual('local project')
    })

    it('does not find a local eslint when useGlobalEslint is true', () => {
      const modulesDir = getFixturesPath('local-eslint', 'node_modules')
      const findDirProps = { modulesDir, useGlobalEslint: true, globalNodePath }
      const foundEslint = findESLintDirectory(findDirProps)
      const expectedEslintPath = getFixturesPath('local-eslint', 'node_modules', 'eslint')
      expect(foundEslint.path).not.toEqual(expectedEslintPath)
      expect(foundEslint.type).not.toEqual('local project')
    })

    it('finds a global eslint when useGlobalEslint is true and a valid globalNodePath is provided', () => {
      const modulesDir = getFixturesPath('local-eslint', 'node_modules')
      const foundDirProps = { modulesDir, useGlobalEslint: true, globalNodePath }
      const foundEslint = findESLintDirectory(foundDirProps)
      const expectedEslintPath = process.platform === 'win32'
        ? join(globalNodePath, 'node_modules', 'eslint')
        : join(globalNodePath, 'lib', 'node_modules', 'eslint')
      expect(foundEslint.path).toEqual(expectedEslintPath)
      expect(foundEslint.type).toEqual('global')
    })

    it('falls back to the packaged eslint when no local eslint is found', () => {
      const modulesDir = 'not/a/real/path'
      const foundDirProps = { modulesDir, useGlobalEslint: false }
      const foundEslint = findESLintDirectory(foundDirProps)
      const expectedBundledPath = join(__dirname, '..', 'node_modules', 'eslint')
      expect(foundEslint.path).toEqual(expectedBundledPath)
      expect(foundEslint.type).toEqual('bundled fallback')
    })
  })

  describe('getESLintInstance', () => {
    it('finds a valid eslint path eslint', () => {
      const eslintDir =
        getFixturesPath('local-eslint', 'node_modules', 'eslint')

      expect(getESLintInstance(eslintDir)).toBe('located')
    })

    it('cries if given invalid ESLint Path', () => {
      expect(() => {
        getESLintInstance(getFixturesPath('files'))
      }).toThrow('ESLint not found, try restarting Atom to clear caches.')
    })
  })


  describe('getRules', () => {
    it('works with the getRules function introduced in ESLint v4.15.0', () => {
      const cliEngine = {
        getRules: () => 'foo'
      }
      expect(getRules(cliEngine)).toBe('foo')
    })

    it('works with the hidden linter in ESLint v4 before v4.15.0', () => {
      const cliEngine = {
        linter: {
          getRules: () => 'foo'
        }
      }
      expect(getRules(cliEngine)).toBe('foo')
    })

    it('returns an empty Map for old ESLint versions', () => {
      const cliEngine = {}
      expect(getRules(cliEngine)).toEqual(new Map())
    })
  })

  describe('didRulesChange', () => {
    const emptyRules = new Map()
    const rules1 = new Map([['rule1', {}]])
    const rules2 = new Map([['rule1', {}], ['rule2', {}]])

    it('returns false for empty Maps', () => {
      const newRules = new Map()
      expect(didRulesChange(emptyRules, newRules)).toBe(false)
    })

    it('returns false when they are the same', () => {
      expect(didRulesChange(rules1, rules1)).toBe(false)
    })

    it('returns true when a new rule is added to an empty list', () => {
      expect(didRulesChange(emptyRules, rules1)).toBe(true)
    })

    it('returns true when the last rule is removed', () => {
      expect(didRulesChange(rules1, emptyRules)).toBe(true)
    })

    it('returns true when a new rule is added to an existing list', () => {
      expect(didRulesChange(rules1, rules2)).toBe(true)
    })

    it('returns true when a rule is removed from an existing list', () => {
      expect(didRulesChange(rules2, rules1)).toBe(true)
    })
  })
})
