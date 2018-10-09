'use babel'

import * as Path from 'path'
import rimraf from 'rimraf'
import * as Helpers from '../src/worker-helpers'
import { copyFileToTempDir } from './linter-eslint-spec'

const getFixturesPath = path => Path.join(__dirname, 'fixtures', path)


const globalNodePath = process.platform === 'win32'
  ? Path.join(getFixturesPath('global-eslint'), 'lib')
  : getFixturesPath('global-eslint')

function createConfig(overrides = {}) {
  return Object.assign(
    {},
    overrides,
    { global: Object.assign({}, overrides.global) },
    { autofix: Object.assign({}, overrides.autofix) },
    { disabling: Object.assign({}, overrides.disabling) },
    { advanced: Object.assign({}, overrides.advanced) },
  )
}

describe('Worker Helpers', () => {
  describe('findESLintDirectory', () => {
    it('returns an object with path and type keys', () => {
      const modulesDir = Path.join(getFixturesPath('local-eslint'), 'node_modules')
      const foundEslint = Helpers.findESLintDirectory(modulesDir, createConfig())
      expect(typeof foundEslint === 'object').toBe(true)
      expect(foundEslint.path).toBeDefined()
      expect(foundEslint.type).toBeDefined()
    })

    it('finds a local eslint when useGlobalEslint is false', () => {
      const modulesDir = Path.join(getFixturesPath('local-eslint'), 'node_modules')
      const config = createConfig({ global: { useGlobalEslint: false } })
      const foundEslint = Helpers.findESLintDirectory(modulesDir, config)
      const expectedEslintPath = Path.join(getFixturesPath('local-eslint'), 'node_modules', 'eslint')
      expect(foundEslint.path).toEqual(expectedEslintPath)
      expect(foundEslint.type).toEqual('local project')
    })

    it('does not find a local eslint when useGlobalEslint is true', () => {
      const modulesDir = Path.join(getFixturesPath('local-eslint'), 'node_modules')
      const config = createConfig({ global: { useGlobalEslint: true, globalNodePath } })
      const foundEslint = Helpers.findESLintDirectory(modulesDir, config)
      const expectedEslintPath = Path.join(getFixturesPath('local-eslint'), 'node_modules', 'eslint')
      expect(foundEslint.path).not.toEqual(expectedEslintPath)
      expect(foundEslint.type).not.toEqual('local project')
    })

    it('finds a global eslint when useGlobalEslint is true and a valid globalNodePath is provided', () => {
      const modulesDir = Path.join(getFixturesPath('local-eslint'), 'node_modules')
      const config = createConfig({ global: { useGlobalEslint: true, globalNodePath } })
      const foundEslint = Helpers.findESLintDirectory(modulesDir, config)
      const expectedEslintPath = process.platform === 'win32'
        ? Path.join(globalNodePath, 'node_modules', 'eslint')
        : Path.join(globalNodePath, 'lib', 'node_modules', 'eslint')
      expect(foundEslint.path).toEqual(expectedEslintPath)
      expect(foundEslint.type).toEqual('global')
    })

    it('falls back to the packaged eslint when no local eslint is found', () => {
      const modulesDir = 'not/a/real/path'
      const config = createConfig({ global: { useGlobalEslint: false } })
      const foundEslint = Helpers.findESLintDirectory(modulesDir, config)
      const expectedBundledPath = Path.join(__dirname, '..', 'node_modules', 'eslint')
      expect(foundEslint.path).toEqual(expectedBundledPath)
      expect(foundEslint.type).toEqual('bundled fallback')
    })
  })

  describe('getESLintInstance && getESLintFromDirectory', () => {
    const pathPart = Path.join('testing', 'eslint', 'node_modules')

    it('tries to find an indirect local eslint using an absolute path', () => {
      const path = Path.join(getFixturesPath('indirect-local-eslint'), pathPart)
      const config = createConfig({
        global: { useGlobalEslint: false },
        advanced: { localNodeModules: path }
      })
      const eslint = Helpers.getESLintInstance('', config)
      expect(eslint).toBe('located')
    })

    it('tries to find an indirect local eslint using a relative path', () => {
      const path = Path.join(getFixturesPath('indirect-local-eslint'), pathPart)
      const [projectPath, relativePath] = atom.project.relativizePath(path)
      const config = createConfig({
        global: { useGlobalEslint: false },
        advanced: { localNodeModules: relativePath }
      })
      const eslint = Helpers.getESLintInstance('', config, projectPath)

      expect(eslint).toBe('located')
    })

    it('tries to find a local eslint', () => {
      const config = createConfig()
      const eslint = Helpers.getESLintInstance(getFixturesPath('local-eslint'), config)
      expect(eslint).toBe('located')
    })

    it('cries if local eslint is not found', () => {
      expect(() => {
        const config = createConfig()
        Helpers.getESLintInstance(getFixturesPath('files', config))
      }).toThrow()
    })

    it('tries to find a global eslint if config is specified', () => {
      const config = createConfig({
        global: { useGlobalEslint: true, globalNodePath }
      })
      console.log({ config })
      const eslint = Helpers.getESLintInstance(getFixturesPath('local-eslint'), config)
      expect(eslint).toBe('located')
    })

    it('cries if global eslint is not found', () => {
      expect(() => {
        const config = createConfig({
          global: { useGlobalEslint: true, globalNodePath: getFixturesPath('files') }
        })
        Helpers.getESLintInstance(getFixturesPath('local-eslint'), config)
      }).toThrow()
    })

    it('tries to find a local eslint with nested node_modules', () => {
      const fileDir = Path.join(getFixturesPath('local-eslint'), 'lib', 'foo.js')
      const config = createConfig()
      const eslint = Helpers.getESLintInstance(fileDir, config)
      expect(eslint).toBe('located')
    })
  })

  describe('getConfigPath', () => {
    it('finds .eslintrc', () => {
      const fileDir = getFixturesPath(Path.join('configs', 'no-ext'))
      const expectedPath = Path.join(fileDir, '.eslintrc')
      expect(Helpers.getConfigPath(fileDir)).toBe(expectedPath)
    })

    it('finds .eslintrc.yaml', () => {
      const fileDir = getFixturesPath(Path.join('configs', 'yaml'))
      const expectedPath = Path.join(fileDir, '.eslintrc.yaml')
      expect(Helpers.getConfigPath(fileDir)).toBe(expectedPath)
    })

    it('finds .eslintrc.yml', () => {
      const fileDir = getFixturesPath(Path.join('configs', 'yml'))
      const expectedPath = Path.join(fileDir, '.eslintrc.yml')
      expect(Helpers.getConfigPath(fileDir)).toBe(expectedPath)
    })

    it('finds .eslintrc.js', () => {
      const fileDir = getFixturesPath(Path.join('configs', 'js'))
      const expectedPath = Path.join(fileDir, '.eslintrc.js')
      expect(Helpers.getConfigPath(fileDir)).toBe(expectedPath)
    })

    it('finds .eslintrc.json', () => {
      const fileDir = getFixturesPath(Path.join('configs', 'json'))
      const expectedPath = Path.join(fileDir, '.eslintrc.json')
      expect(Helpers.getConfigPath(fileDir)).toBe(expectedPath)
    })

    it('finds package.json with an eslintConfig property', () => {
      const fileDir = getFixturesPath(Path.join('configs', 'package-json'))
      const expectedPath = Path.join(fileDir, 'package.json')
      expect(Helpers.getConfigPath(fileDir)).toBe(expectedPath)
    })

    it('ignores package.json with no eslintConfig property', () => {
      const fileDir = getFixturesPath(Path.join('configs', 'package-json', 'nested'))
      const expectedPath = getFixturesPath(Path.join('configs', 'package-json', 'package.json'))
      expect(Helpers.getConfigPath(fileDir)).toBe(expectedPath)
    })
  })

  describe('getRelativePath', () => {
    it('return path relative of ignore file if found', () => {
      const fixtureDir = getFixturesPath('eslintignore')
      const fixtureFile = Path.join(fixtureDir, 'ignored.js')
      const config = createConfig()
      const relativePath = Helpers.getRelativePath(fixtureDir, fixtureFile, config)
      const expectedPath = Path.relative(Path.join(__dirname, '..'), fixtureFile)
      expect(relativePath).toBe(expectedPath)
    })

    it('does not return path relative to ignore file if config overrides it', () => {
      const fixtureDir = getFixturesPath('eslintignore')
      const fixtureFile = Path.join(fixtureDir, 'ignored.js')
      const config = createConfig({
        advanced: { disableEslintIgnore: true }
      })
      const relativePath = Helpers.getRelativePath(fixtureDir, fixtureFile, config)
      expect(relativePath).toBe('ignored.js')
    })

    it('returns the path relative to the project dir if provided when no ignore file is found', async () => {
      const fixtureFile = getFixturesPath(Path.join('files', 'good.js'))
      // Copy the file to a temporary folder
      const tempFixturePath = await copyFileToTempDir(fixtureFile)
      const tempDir = Path.dirname(tempFixturePath)
      const filepath = Path.join(tempDir, 'good.js')
      const tempDirParent = Path.dirname(tempDir)
      const config = createConfig()

      const relativePath = Helpers.getRelativePath(tempDir, filepath, config, tempDirParent)
      // Since the project is the parent of the temp dir, the relative path should be
      // the dir containing the file, plus the file. (e.g. asgln3/good.js)
      const expectedPath = Path.join(Path.basename(tempDir), 'good.js')
      expect(relativePath).toBe(expectedPath)
      // Remove the temporary directory
      rimraf.sync(tempDir)
    })

    it('returns just the file being linted if no ignore file is found and no project dir is provided', async () => {
      const fixtureFile = getFixturesPath(Path.join('files', 'good.js'))
      // Copy the file to a temporary folder
      const tempFixturePath = await copyFileToTempDir(fixtureFile)
      const tempDir = Path.dirname(tempFixturePath)
      const filepath = Path.join(tempDir, 'good.js')
      const config = createConfig()

      const relativePath = Helpers.getRelativePath(tempDir, filepath, config, null)
      expect(relativePath).toBe('good.js')

      // Remove the temporary directory
      rimraf.sync(tempDir)
    })
  })

  describe('getRules', () => {
    it('works with the getRules function introduced in ESLint v4.15.0', () => {
      const cliEngine = {
        getRules: () => 'foo'
      }
      expect(Helpers.getRules(cliEngine)).toBe('foo')
    })

    it('works with the hidden linter in ESLint v4 before v4.15.0', () => {
      const cliEngine = {
        linter: {
          getRules: () => 'foo'
        }
      }
      expect(Helpers.getRules(cliEngine)).toBe('foo')
    })

    it('returns an empty Map for old ESLint versions', () => {
      const cliEngine = {}
      expect(Helpers.getRules(cliEngine)).toEqual(new Map())
    })
  })

  describe('didRulesChange', () => {
    const emptyRules = new Map()
    const rules1 = new Map([['rule1', {}]])
    const rules2 = new Map([['rule1', {}], ['rule2', {}]])

    it('returns false for empty Maps', () => {
      const newRules = new Map()
      expect(Helpers.didRulesChange(emptyRules, newRules)).toBe(false)
    })

    it('returns false when they are the same', () => {
      expect(Helpers.didRulesChange(rules1, rules1)).toBe(false)
    })

    it('returns true when a new rule is added to an empty list', () => {
      expect(Helpers.didRulesChange(emptyRules, rules1)).toBe(true)
    })

    it('returns true when the last rule is removed', () => {
      expect(Helpers.didRulesChange(rules1, emptyRules)).toBe(true)
    })

    it('returns true when a new rule is added to an existing list', () => {
      expect(Helpers.didRulesChange(rules1, rules2)).toBe(true)
    })

    it('returns true when a rule is removed from an existing list', () => {
      expect(Helpers.didRulesChange(rules2, rules1)).toBe(true)
    })
  })
})
