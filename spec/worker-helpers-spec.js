'use babel'

import * as Helpers from '../lib/worker-helpers'
import { getFixturesPath } from './common'
import * as Path from 'path'

describe('Worker Helpers', function () {
  describe('getESLintInstance && getESLintFromDirectory', function () {
    it('tries to find a local eslint', function () {
      const eslint = Helpers.getESLintInstance(getFixturesPath('local-eslint'), {})
      expect(eslint).toBe('located')
    })
    it('cries if local eslint is not found', function () {
      expect(function () {
        Helpers.getESLintInstance(getFixturesPath('files', {}))
      }).toThrow()
    })

    it('tries to find a global eslint if config is specified', function () {
      const eslint = Helpers.getESLintInstance(getFixturesPath('local-eslint'), {
        useGlobalEslint: true,
        globalNodePath: getFixturesPath('global-eslint')
      })
      expect(eslint).toBe('located')
    })
    it('cries if global eslint is not found', function () {
      expect(function () {
        Helpers.getESLintInstance(getFixturesPath('local-eslint'), {
          useGlobalEslint: true
        })
      }).toThrow()
    })
  })

  describe('getConfigPath', function () {
    it('finds .eslintrc', function () {
      const fileDir = getFixturesPath('configs/no-ext/')
      const expectedPath = Path.join(fileDir, '.eslintrc')
      expect(Helpers.getConfigPath(fileDir)).toBe(expectedPath)
    })
    it('finds .eslintrc.yaml', function () {
      const fileDir = getFixturesPath('configs/yaml/')
      const expectedPath = Path.join(fileDir, '.eslintrc.yaml')
      expect(Helpers.getConfigPath(fileDir)).toBe(expectedPath)
    })
    it('finds .eslintrc.yml', function () {
      const fileDir = getFixturesPath('configs/yml/')
      const expectedPath = Path.join(fileDir, '.eslintrc.yml')
      expect(Helpers.getConfigPath(fileDir)).toBe(expectedPath)
    })
    it('finds .eslintrc.js', function () {
      const fileDir = getFixturesPath('configs/js/')
      const expectedPath = Path.join(fileDir, '.eslintrc.js')
      expect(Helpers.getConfigPath(fileDir)).toBe(expectedPath)
    })
    it('finds .eslintrc.json', function () {
      const fileDir = getFixturesPath('configs/json/')
      const expectedPath = Path.join(fileDir, '.eslintrc.json')
      expect(Helpers.getConfigPath(fileDir)).toBe(expectedPath)
    })
  })

  describe('getRelativePath', function () {
    it('return path relative of ignore file if found', function () {
      const fixtureDir = getFixturesPath('eslintignore')
      const fixtureFile = Path.join(fixtureDir, 'ignored.js')
      const relativePath = Helpers.getRelativePath(fixtureDir, fixtureFile, {})
      const expectedPath = Path.relative(__dirname + '/../', fixtureFile)
      expect(relativePath).toBe(expectedPath)
    })
    it('does not return path relative to ignore file if config overrides it', function () {
      const fixtureDir = getFixturesPath('eslintignore')
      const fixtureFile = Path.join(fixtureDir, 'ignored.js')
      const relativePath =
        Helpers.getRelativePath(fixtureDir, fixtureFile, { disableEslintIgnore: true })
      expect(relativePath).toBe('ignored.js')
    })
  })
})
