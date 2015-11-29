'use babel'

import Path from 'path'
import OS from 'os'
import {mkdir, cp, rm} from 'shelljs'
import {
  determineConfigFile,
  findEslintDir,
  getEslintCli
} from '../lib/es5-helpers'

let fixtureDir

describe('The es5 linter-eslint helper', () => {
  /**
   * Returns the path inside of the fixture directory.
   * @param   {string} path  A UNIX-style path ('/' seperators) relative to the
   *                         'spec/fixtures' directory.
   * @returns {string}       The path inside the fixture directory.
   * @private
   */
  function getFixturePath(path) {
    const args = path.split('/')
    args.unshift(fixtureDir)
    return Path.join.apply(Path, args)
  }

  it('test setup', () => {
    // copy into clean area so as not to get "infected" by this project's .eslintrc files
    fixtureDir = OS.tmpdir() + '/linter-eslint/fixtures'
    mkdir('-p', fixtureDir)
    cp('-r', './spec/fixtures/.', fixtureDir)
  })

  describe('determineConfigFile', () => {
    it('finds a .eslintrc file', () => {
      const dir = getFixturePath('configs/no-ext/')
      const expectedPath = Path.join(dir, '.eslintrc')
      const params = { fileDir: dir }
      const foundConfigFile = determineConfigFile(params)
      expect(foundConfigFile).toEqual(expectedPath)
    })

    it('finds an .eslintrc.yaml file', () => {
      const dir = getFixturePath('configs/yaml/')
      const expectedPath = Path.join(dir, '.eslintrc.yaml')
      const params = { fileDir: dir }
      const foundConfigFile = determineConfigFile(params)
      expect(foundConfigFile).toEqual(expectedPath)
    })

    it('finds an .eslintrc.yml file', () => {
      const dir = getFixturePath('configs/yml/')
      const expectedPath = Path.join(dir, '.eslintrc.yml')
      const params = { fileDir: dir }
      const foundConfigFile = determineConfigFile(params)
      expect(foundConfigFile).toEqual(expectedPath)
    })

    it('finds an .eslintrc.js file', () => {
      const dir = getFixturePath('configs/js/')
      const expectedPath = Path.join(dir, '.eslintrc.js')
      const params = { fileDir: dir }
      const foundConfigFile = determineConfigFile(params)
      expect(foundConfigFile).toEqual(expectedPath)
    })

    it('finds an .eslintrc.json file', () => {
      const dir = getFixturePath('configs/json/')
      const expectedPath = Path.join(dir, '.eslintrc.json')
      const params = { fileDir: dir }
      const foundConfigFile = determineConfigFile(params)
      expect(foundConfigFile).toEqual(expectedPath)
    })

    it('finds a package.json file with an eslintConfig section', () => {
      const dir = getFixturePath('configs/package-json/')
      const expectedPath = Path.join(dir, 'package.json')
      const params = { fileDir: dir }
      const foundConfigFile = determineConfigFile(params)
      expect(foundConfigFile).toEqual(expectedPath)
    })

    describe('if no configuration file is found', () => {
      it('returns undefined if no configFile option is set', () => {
        const dir = getFixturePath('configs/none/')
        const expectedPath = undefined
        const params = { fileDir: dir }
        const foundConfigFile = determineConfigFile(params)
        expect(foundConfigFile).toEqual(expectedPath)
      })

      it('returns null if canDisable option is set', () => {
        const dir = getFixturePath('configs/none/')
        const expectedPath = null
        const params = {
          fileDir: dir,
          canDisable: true
        }
        const foundConfigFile = determineConfigFile(params)
        expect(foundConfigFile).toEqual(expectedPath)
      })

      it('returns null if canDisable option is set, even if configFile option is set', () => {
        const dir = getFixturePath('configs/none/')
        const expectedPath = null
        const params = {
          fileDir: dir,
          canDisable: true,
          configFile: '/home/test/config.js'
        }
        const foundConfigFile = determineConfigFile(params)
        expect(foundConfigFile).toEqual(expectedPath)
      })

      it('returns specified configFile if option is set and canDisable is false', () => {
        const dir = getFixturePath('configs/none/')
        const expectedPath = '/home/test/config.js'
        const params = {
          fileDir: dir,
          canDisable: false,
          configFile: expectedPath
        }
        const foundConfigFile = determineConfigFile(params)
        expect(foundConfigFile).toEqual(expectedPath)
      })
    })

    describe('findEslintDir', () => {
      it('locates a local installation of eslint', () => {
        const dir = getFixturePath('local-eslint/lib')
        const expectedPath = getFixturePath('local-eslint/node_modules/eslint')
        const params = {
          fileDir: dir,
          global: false,
        }
        const foundEslintDir = findEslintDir(params)
        expect(foundEslintDir).toEqual(expectedPath)
      })
    })

    describe('getEslintCli', () => {
      it('locates eslint\'s cli.js in a local installation', () => {
        const expectedEslintCli = 'located'
        const path = getFixturePath('local-eslint/node_modules/eslint')
        const foundEslintCli = getEslintCli(path)
        expect(foundEslintCli).toEqual(expectedEslintCli)
      })
    })
  })

  it('teardown', () => {
    // Clean up temporary directory
    rm('-r', fixtureDir)
  })
})
