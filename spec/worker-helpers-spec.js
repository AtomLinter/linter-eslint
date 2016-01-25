'use babel'

import * as Helpers from '../lib/worker-helpers'
import { getFixturesPath } from './common'
import * as Path from 'path'

describe('Worker Helpers', () => {
  describe('getESLintInstance && getESLintFromDirectory', () => {
    it('tries to find a local eslint', () => {
      const eslint = Helpers.getESLintInstance(getFixturesPath('local-eslint'), {})
      expect(eslint).toBe('located')
    })
    it('cries if local eslint is not found', () => {
      expect(() => {
        Helpers.getESLintInstance(getFixturesPath('files', {}))
      }).toThrow()
    })

    it('tries to find a global eslint if config is specified', () => {
      let globalPath = ''
      if (process.platform === 'win32') {
        globalPath = getFixturesPath(Path.join('global-eslint', 'lib'))
      } else {
        globalPath = getFixturesPath('global-eslint')
      }
      const eslint = Helpers.getESLintInstance(getFixturesPath('local-eslint'), {
        useGlobalEslint: true,
        globalNodePath: globalPath
      })
      expect(eslint).toBe('located')
    })
    it('cries if global eslint is not found', () => {
      expect(() => {
        Helpers.getESLintInstance(getFixturesPath('local-eslint'), {
          useGlobalEslint: true,
          globalNodePath: getFixturesPath('files')
        })
      }).toThrow()
    })

    it('tries to find a local eslint with nested node_modules', () => {
      const fileDir = Path.join(getFixturesPath('local-eslint'), 'lib', 'foo.js')
      const eslint = Helpers.getESLintInstance(fileDir, {})
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
  })

  describe('getRelativePath', () => {
    it('return path relative of ignore file if found', () => {
      const fixtureDir = getFixturesPath('eslintignore')
      const fixtureFile = Path.join(fixtureDir, 'ignored.js')
      const relativePath = Helpers.getRelativePath(fixtureDir, fixtureFile, {})
      const expectedPath = Path.relative(Path.join(__dirname, '..'), fixtureFile)
      expect(relativePath).toBe(expectedPath)
    })
    it('does not return path relative to ignore file if config overrides it', () => {
      const fixtureDir = getFixturesPath('eslintignore')
      const fixtureFile = Path.join(fixtureDir, 'ignored.js')
      const relativePath =
        Helpers.getRelativePath(fixtureDir, fixtureFile, { disableEslintIgnore: true })
      expect(relativePath).toBe('ignored.js')
    })
  })
})
