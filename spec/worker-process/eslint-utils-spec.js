'use babel'

import { join } from 'path'
import { fixturesPath } from '../spec-utils'
import {
  findEslintDir,
  eslintDirType,
  getEslintInstance
} from '../../src/worker-process/eslint-utils'

describe('eslintDirType', () => {
  it('returns global if use-global is truthy', () => {
    expect(eslintDirType({ useGlobalEslint: true })).toBe('global')
    expect(eslintDirType({
      useGlobalEslint: true,
      advancedLocalNodeModules: false
    })).toBe('global')
  })
  it('returns specified if local-node is truthy and use-global is falsy', () =>
    expect(eslintDirType({
      advancedLocalNodeModules: true
    })).toBe('advanced specified'))
  it('returns local-project if local-node and use-global both falsy', () => {
    expect(eslintDirType({})).toBe('local project')
  })
})

describe('getEslintInstance', () => {
  it('finds a valid eslint path eslint', () => {
    const eslintDir =
      fixturesPath('local-eslint', 'node_modules', 'eslint')

    expect(getEslintInstance(eslintDir)).toBe('located')
  })

  it('cries if given invalid ESLint Path', () => {
    expect(() => {
      getEslintInstance(fixturesPath('files'))
    }).toThrow('ESLint not found, try restarting Atom to clear caches.')
  })
})

describe('findEslintDir', () => {
  it('finds a local eslint', () => {
    const modulesDir = fixturesPath('local-eslint', 'node_modules')
    const type = 'local project'

    const foundEslint = findEslintDir(type)({ modulesDir })
    const expectedPath = fixturesPath('local-eslint', 'node_modules', 'eslint')

    expect(foundEslint).toEqual(expectedPath)
  })

  it('finds a global eslint', () => {
    const type = 'global'
    const globalNodePath = process.platform === 'win32' ?
      fixturesPath('global-eslint', 'lib') :
      fixturesPath('global-eslint')

    const foundEslint = findEslintDir(type)({ globalNodePath })

    const expectedPath = process.platform === 'win32'
      ? join(globalNodePath, 'node_modules', 'eslint')
      : join(globalNodePath, 'lib', 'node_modules', 'eslint')

    expect(foundEslint).toEqual(expectedPath)
  })

  it('finds a specified eslint', () => {
    const type = 'advanced specified'
    const advancedLocalNodeModules =
      fixturesPath('local-eslint', 'node_modules')

    const foundEslint = findEslintDir(type)({ advancedLocalNodeModules })
    const expectedPath = fixturesPath('local-eslint', 'node_modules', 'eslint')

    expect(foundEslint).toEqual(expectedPath)
  })
})
