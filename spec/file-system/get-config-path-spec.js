'use babel'

import { join } from 'path'

import getConfigPath from '../../src/file-system/get-config-path'

const configsFixturePath = (...args) =>
  join(__dirname, '..', 'fixtures', 'configs', ...args)

describe('getConfigPath', () => {
  it('finds .eslintrc', () => {
    const fileDir = configsFixturePath('no-ext')
    const expectedPath = join(fileDir, '.eslintrc')
    expect(getConfigPath(fileDir)).toBe(expectedPath)
  })

  it('finds .eslintrc.yaml', () => {
    const fileDir = configsFixturePath('yaml')
    const expectedPath = join(fileDir, '.eslintrc.yaml')
    expect(getConfigPath(fileDir)).toBe(expectedPath)
  })

  it('finds .eslintrc.yml', () => {
    const fileDir = configsFixturePath('yml')
    const expectedPath = join(fileDir, '.eslintrc.yml')
    expect(getConfigPath(fileDir)).toBe(expectedPath)
  })

  it('finds .eslintrc.js', () => {
    const fileDir = configsFixturePath('js')
    const expectedPath = join(fileDir, '.eslintrc.js')
    expect(getConfigPath(fileDir)).toBe(expectedPath)
  })

  it('finds .eslintrc.json', () => {
    const fileDir = configsFixturePath('json')
    const expectedPath = join(fileDir, '.eslintrc.json')
    expect(getConfigPath(fileDir)).toBe(expectedPath)
  })

  it('finds package.json with an eslintConfig property', () => {
    const fileDir = configsFixturePath('package-json')
    const expectedPath = join(fileDir, 'package.json')
    expect(getConfigPath(fileDir)).toBe(expectedPath)
  })

  it('ignores package.json with no eslintConfig property', () => {
    const fileDir = configsFixturePath('package-json', 'nested')
    const expectedPath = configsFixturePath('package-json', 'package.json')
    expect(getConfigPath(fileDir)).toBe(expectedPath)
  })
})
