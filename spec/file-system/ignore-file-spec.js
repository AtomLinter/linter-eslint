'use babel'

import { join } from 'path'
import { cleanPath } from '../../src/file-system'
import { getIgnoreFile } from '../../src/file-system/ignore-file'

const linterEslintRoot = cleanPath(join(__dirname, '..', '..'))
const fsFixturePath = () => join(__dirname, '..', 'fixtures', 'fs')

describe('getIgnoreFile', () => {
  const ignoreFixturePath = (...files) =>
    join(fsFixturePath(), 'get-ignore', ...files)

  it('returns null if disableEslintIgnore true, ignoring fileDir', () => {
    const disableEslintIgnore = true

    const validPath = ignoreFixturePath('with-ignore', 'without-ignore')
    const validPathProps = { disableEslintIgnore, fileDir: validPath }
    expect(getIgnoreFile(validPathProps)).toBe(null)

    const invalidPath = '/not/a/valid/path'
    const invalidPathProps = { disableEslintIgnore, fileDir: invalidPath }
    expect(getIgnoreFile(invalidPathProps)).toBe(null)
  })

  it('finds same directory if ignore file found', () => {
    const searchPath = ignoreFixturePath('with-ignore')
    const searchProps = { fileDir: searchPath }

    const expectedPath = join(searchPath, '.eslintignore')

    expect(getIgnoreFile(searchProps)).toBe(expectedPath)
  })

  it('finds first parent directory if ignore first found in parent', () => {
    const searchPath = ignoreFixturePath('with-ignore', 'without-ignore')
    const searchProps = { fileDir: searchPath }

    const expectedPath = ignoreFixturePath('with-ignore', '.eslintignore')
    expect(getIgnoreFile(searchProps)).toBe(expectedPath)
  })

  it('finds project root if no ignore file found in prior parents', () => {
    const searchPath = ignoreFixturePath('without-ignore')
    const searchProps = { fileDir: searchPath }

    const expectedPath = join(linterEslintRoot, '.eslintignore')
    expect(getIgnoreFile(searchProps)).toBe(expectedPath)
  })
})
