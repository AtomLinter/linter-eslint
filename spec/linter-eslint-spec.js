'use babel'

import linter from '../lib/main'
import * as path from 'path'

const goodPath = path.join(__dirname, 'fixtures', 'files', 'good.js')
const badPath = path.join(__dirname, 'fixtures', 'files', 'bad.js')
const emptyPath = path.join(__dirname, 'fixtures', 'files', 'empty.js')
const fixPath = path.join(__dirname, 'fixtures', 'files', 'fix.js')
const importingpath = path.join(__dirname, 'fixtures',
  'import-resolution', 'nested', 'importing.js')
const badImportPath = path.join(__dirname, 'fixtures',
  'import-resolution', 'nested', 'badImport.js')
const ignoredPath = path.join(__dirname, 'fixtures',
  'eslintignore', 'ignored.js')

describe('The eslint provider for Linter', () => {
  const { spawnWorker } = require('../lib/helpers')
  const worker = spawnWorker()
  const lint = linter.provideLinter.call(worker).lint

  beforeEach(() => {
    atom.config.set('linter-eslint.disableFSCache', false)
    atom.config.set('linter-eslint.disableEslintIgnore', true)
    waitsForPromise(() =>
      atom.packages.activatePackage('language-javascript').then(() =>
        atom.workspace.open(goodPath)
      )
    )
  })

  describe('checks bad.js and', () => {
    let editor = null
    beforeEach(() => {
      waitsForPromise(() =>
        atom.workspace.open(badPath).then(openEditor => {
          editor = openEditor
        })
      )
    })

    it('finds at least one message', () => {
      waitsForPromise(() =>
        lint(editor).then(messages => {
          expect(messages.length).toBeGreaterThan(0)
        })
      )
    })

    it('verifies that message', () => {
      waitsForPromise(() =>
        lint(editor).then(messages => {
          expect(messages[0].type).toBeDefined()
          expect(messages[0].type).toEqual('Error')
          expect(messages[0].html).not.toBeDefined()
          expect(messages[0].text).toBeDefined()
          expect(messages[0].text).toEqual('\'foo\' is not defined.')
          expect(messages[0].filePath).toBeDefined()
          expect(messages[0].filePath).toMatch(/.+spec[\\\/]fixtures[\\\/]files[\\\/]bad\.js$/)
          expect(messages[0].range).toBeDefined()
          expect(messages[0].range.length).toEqual(2)
          expect(messages[0].range).toEqual([[0, 0], [0, 9]])
          expect(messages[0].hasOwnProperty('fix')).toBeFalsy()
        })
      )
    })
  })

  it('finds nothing wrong with an empty file', () => {
    waitsForPromise(() =>
      atom.workspace.open(emptyPath).then(editor =>
        lint(editor).then(messages => {
          expect(messages.length).toEqual(0)
        })
      )
    )
  })

  it('finds nothing wrong with a valid file', () => {
    waitsForPromise(() =>
      atom.workspace.open(goodPath).then(editor =>
        lint(editor).then(messages => {
          expect(messages.length).toEqual(0)
        })
      )
    )
  })

  it('reports the fixes for fixable errors', () => {
    waitsForPromise(() =>
      atom.workspace.open(fixPath).then(editor =>
        lint(editor)
      ).then(messages => {
        expect(messages[0].fix.range).toEqual([[0, 11], [0, 12]])
        expect(messages[0].fix.newText).toEqual('')

        expect(messages[1].fix.range).toEqual([[2, 1], [2, 1]])
        expect(messages[1].fix.newText).toEqual(' ')
      })
    )
  })

  describe('when resolving import paths using eslint-plugin-import', () => {
    it('correctly resolves imports from parent', () => {
      waitsForPromise(() =>
        atom.workspace.open(importingpath).then(editor =>
          lint(editor).then(messages => {
            expect(messages.length).toEqual(0)
          })
        )
      )
    })
    it('shows a message for an invalid import', () => {
      waitsForPromise(() =>
        atom.workspace.open(badImportPath).then(editor =>
          lint(editor).then(messages => {
            expect(messages.length).toBeGreaterThan(0)
            expect(messages[0].type).toBe('Error')
            expect(messages[0].html).not.toBeDefined()
            expect(messages[0].text).toEqual('Unable to resolve path to module \'../nonexistent\'.')
            expect(messages[0].filePath).toBe(badImportPath)
            expect(messages[0].range).toEqual([[0, 24], [0, 40]])
            expect(messages[0].hasOwnProperty('fix')).toBeFalsy()
          })
        )
      )
    })
  })

  describe('when a file is specified in an .eslintignore file', () => {
    beforeEach(() => {
      atom.config.set('linter-eslint.disableEslintIgnore', false)
    })
    it('will not give warnings for the file', () => {
      waitsForPromise(() =>
        atom.workspace.open(ignoredPath).then(editor =>
          lint(editor).then(messages => {
            expect(messages.length).toEqual(0)
          })
        )
      )
    })
  })

  describe('Fix errors when saved', () => {
    beforeEach(() => {
      atom.config.set('linter-eslint.fixOnSave', true)
    })
    it('should fix lint errors when saved', () => {
      waitsForPromise(() =>
        atom.workspace.open(fixPath).then(editor => {
          lint(editor).then(messages => {
            expect(messages.length).toEqual(2)
            editor.save()
            lint(editor).then(messagesAfterSave => {
              expect(messagesAfterSave.length).toEqual(0)
            })
          })
        })
      )
    })
  })
})
