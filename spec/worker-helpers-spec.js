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
      const foundEslint = findESLintDirectory({ modulesDir, config: {} })
      expect(typeof foundEslint === 'object').toBe(true)
      expect(foundEslint.path).toBeDefined()
      expect(foundEslint.type).toBeDefined()
    })

    it('finds a local eslint when useGlobalEslint is false', () => {
      const modulesDir = getFixturesPath('local-eslint', 'node_modules')
      const foundEslint = findESLintDirectory({
        modulesDir,
        config: { useGlobalEslint: false }
      })
      const expectedEslintPath = getFixturesPath('local-eslint', 'node_modules', 'eslint')
      expect(foundEslint.path).toEqual(expectedEslintPath)
      expect(foundEslint.type).toEqual('local project')
    })

    it('does not find a local eslint when useGlobalEslint is true', () => {
      const modulesDir = getFixturesPath('local-eslint', 'node_modules')
      const config = { useGlobalEslint: true, globalNodePath }
      const foundEslint = findESLintDirectory({ modulesDir, config })
      const expectedEslintPath = getFixturesPath('local-eslint', 'node_modules', 'eslint')
      expect(foundEslint.path).not.toEqual(expectedEslintPath)
      expect(foundEslint.type).not.toEqual('local project')
    })

    it('finds a global eslint when useGlobalEslint is true and a valid globalNodePath is provided', () => {
      const modulesDir = getFixturesPath('local-eslint', 'node_modules')
      const config = { useGlobalEslint: true, globalNodePath }
      const foundEslint = findESLintDirectory({ modulesDir, config })
      const expectedEslintPath = process.platform === 'win32'
        ? join(globalNodePath, 'node_modules', 'eslint')
        : join(globalNodePath, 'lib', 'node_modules', 'eslint')
      expect(foundEslint.path).toEqual(expectedEslintPath)
      expect(foundEslint.type).toEqual('global')
    })

    it('falls back to the packaged eslint when no local eslint is found', () => {
      const modulesDir = 'not/a/real/path'
      const config = { useGlobalEslint: false }
      const foundEslint = findESLintDirectory({ modulesDir, config })
      const expectedBundledPath = join(__dirname, '..', 'node_modules', 'eslint')
      expect(foundEslint.path).toEqual(expectedBundledPath)
      expect(foundEslint.type).toEqual('bundled fallback')
    })
  })

  describe('getESLintInstance && getESLintFromDirectory', () => {
    const pathPart = join('testing', 'eslint', 'node_modules')

    it('tries to find an indirect local eslint using an absolute path', () => {
      const path = getFixturesPath('indirect-local-eslint', pathPart)
      const eslint = getESLintInstance({
        fileDir: '',
        config: {
          useGlobalEslint: false,
          advancedLocalNodeModules: path
        }
      })
      expect(eslint).toBe('located')
    })

    it('tries to find an indirect local eslint using a relative path', () => {
      const path = getFixturesPath('indirect-local-eslint', pathPart)
      const [projectPath, relativePath] = atom.project.relativizePath(path)

      const eslint = getESLintInstance({
        fileDir: '',
        config: {
          useGlobalEslint: false,
          advancedLocalNodeModules: relativePath
        },
        projectPath
      })

      expect(eslint).toBe('located')
    })

    it('tries to find a local eslint', () => {
      const eslint = getESLintInstance({
        fileDir: getFixturesPath('local-eslint'),
        config: {}
      })
      expect(eslint).toBe('located')
    })

    // TODO Broken spec. Previously was throwing only because of calling
    // path.join with an object param. Needs to make temp folder outside project
    // root to get valid test.
    xit('cries if local eslint is not found', () => {
      expect(() => {
        getESLintInstance({
          fileDir: getFixturesPath('files'),
          config: {}
        })
      }).toThrow()
    })

    it('tries to find a global eslint if config is specified', () => {
      const eslint = getESLintInstance({
        fileDir: getFixturesPath('local-eslint'),
        config: {
          useGlobalEslint: true,
          globalNodePath
        }
      })
      expect(eslint).toBe('located')
    })

    it('cries if global eslint is not found', () => {
      expect(() => {
        getESLintInstance({
          fileDir: getFixturesPath('local-eslint'),
          config: {
            useGlobalEslint: true,
            globalNodePath: getFixturesPath('files')
          }
        })
      }).toThrow()
    })

    it('tries to find a local eslint with nested node_modules', () => {
      const fileDir = getFixturesPath('local-eslint', 'lib', 'foo.js')
      const eslint = getESLintInstance({ fileDir, config: {} })
      expect(eslint).toBe('located')
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
