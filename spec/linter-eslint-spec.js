'use babel'

import * as path from 'path'
import * as fs from 'fs'
import { tmpdir } from 'os'
import rimraf from 'rimraf'
import linter from '../lib/main'
import { idsToIgnoredRules } from '../lib/helpers'

const fixturesDir = path.join(__dirname, 'fixtures')

const goodPath = path.join(fixturesDir, 'files', 'good.js')
const badPath = path.join(fixturesDir, 'files', 'bad.js')
const badInlinePath = path.join(fixturesDir, 'files', 'badInline.js')
const emptyPath = path.join(fixturesDir, 'files', 'empty.js')
const fixPath = path.join(fixturesDir, 'files', 'fix.js')
const configPath = path.join(fixturesDir, 'configs', '.eslintrc.yml')
const importingpath = path.join(fixturesDir,
  'import-resolution', 'nested', 'importing.js')
const badImportPath = path.join(fixturesDir,
  'import-resolution', 'nested', 'badImport.js')
const ignoredPath = path.join(fixturesDir, 'eslintignore', 'ignored.js')
const modifiedIgnorePath = path.join(fixturesDir,
  'modified-ignore-rule', 'foo.js')
const modifiedIgnoreSpacePath = path.join(fixturesDir,
  'modified-ignore-rule', 'foo-space.js')
const endRangePath = path.join(fixturesDir, 'end-range', 'no-unreachable.js')

function copyFileToTempDir(fileToCopyPath) {
  return new Promise((resolve) => {
    const tempFixtureDir = fs.mkdtempSync(tmpdir() + path.sep)
    const tempFixturePath = path.join(tempFixtureDir, path.basename(fileToCopyPath))
    const wr = fs.createWriteStream(tempFixturePath)
    wr.on('close', () =>
      atom.workspace.open(tempFixturePath).then((openEditor) => {
        resolve({ openEditor, tempDir: tempFixtureDir })
      })
    )
    fs.createReadStream(fileToCopyPath).pipe(wr)
  })
}

describe('The eslint provider for Linter', () => {
  const { spawnWorker } = require('../lib/helpers')

  const worker = spawnWorker()
  const lint = linter.provideLinter.call(worker).lint
  const fix = textEditor =>
    worker.worker.request('job', {
      type: 'fix',
      rules: idsToIgnoredRules(atom.config.get('linter-eslint.rulesToDisableWhileFixing')),
      config: atom.config.get('linter-eslint'),
      filePath: textEditor.getPath()
    })

  beforeEach(() => {
    atom.config.set('linter-eslint.disableFSCache', false)
    atom.config.set('linter-eslint.disableEslintIgnore', true)

    waitsForPromise(() =>
      Promise.all([
        atom.packages.activatePackage('language-javascript'),
        atom.packages.activatePackage('linter-eslint'),
      ]).then(() =>
        atom.workspace.open(goodPath)
      )
    )
  })

  describe('checks bad.js and', () => {
    let editor = null
    beforeEach(() => {
      waitsForPromise(() =>
        atom.workspace.open(badPath).then((openEditor) => {
          editor = openEditor
        })
      )
    })

    it('finds at least one message', () => {
      waitsForPromise(() =>
        lint(editor).then(messages => expect(messages.length).toBeGreaterThan(0))
      )
    })

    it('verifies that message', () => {
      waitsForPromise(() =>
        lint(editor).then((messages) => {
          const expected = '&#39;foo&#39; is not defined. ' +
            '(<a href="http://eslint.org/docs/rules/no-undef">no-undef</a>)'
          expect(messages[0].type).toBe('Error')
          expect(messages[0].text).not.toBeDefined()
          expect(messages[0].html).toBe(expected)
          expect(messages[0].filePath).toBe(badPath)
          expect(messages[0].range).toEqual([[0, 0], [0, 3]])
          expect(Object.hasOwnProperty.call(messages[0], 'fix')).toBeFalsy()
        })
      )
    })
  })

  it('finds nothing wrong with an empty file', () => {
    waitsForPromise(() =>
      atom.workspace.open(emptyPath).then(editor =>
        lint(editor).then(messages => expect(messages.length).toBe(0))
      )
    )
  })

  it('finds nothing wrong with a valid file', () => {
    waitsForPromise(() =>
      atom.workspace.open(goodPath).then(editor =>
        lint(editor).then(messages => expect(messages.length).toBe(0))
      )
    )
  })

  it('reports the fixes for fixable errors', () => {
    waitsForPromise(() =>
      atom.workspace.open(fixPath).then(editor =>
        lint(editor)
      ).then((messages) => {
        expect(messages[0].fix.range).toEqual([[0, 10], [1, 8]])
        expect(messages[0].fix.newText).toBe('6\nfunction')

        expect(messages[1].fix.range).toEqual([[2, 0], [2, 1]])
        expect(messages[1].fix.newText).toBe('  ')
      })
    )
  })

  describe('when resolving import paths using eslint-plugin-import', () => {
    it('correctly resolves imports from parent', () => {
      waitsForPromise(() =>
        atom.workspace.open(importingpath).then(editor =>
          lint(editor).then(messages => expect(messages.length).toBe(0))
        )
      )
    })
    it('shows a message for an invalid import', () => {
      waitsForPromise(() =>
        atom.workspace.open(badImportPath).then(editor =>
          lint(editor).then((messages) => {
            const expected = 'Unable to resolve path to module &#39;../nonexistent&#39;. ' +
              '(<a href="https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-unresolved.md">' +
              'import/no-unresolved</a>)'

            expect(messages.length).toBeGreaterThan(0)
            expect(messages[0].type).toBe('Error')
            expect(messages[0].text).not.toBeDefined()
            expect(messages[0].html).toBe(expected)
            expect(messages[0].filePath).toBe(badImportPath)
            expect(messages[0].range).toEqual([[0, 24], [0, 39]])
            expect(Object.hasOwnProperty.call(messages[0], 'fix')).toBeFalsy()
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
          lint(editor).then(messages => expect(messages.length).toBe(0))
        )
      )
    })
  })

  describe('fixes errors', () => {
    let editor
    let doneCheckingFixes
    let tempFixtureDir

    beforeEach(() => {
      doneCheckingFixes = false
      waitsForPromise(() =>
        copyFileToTempDir(fixPath)
          .then(({ openEditor, tempDir }) => {
            editor = openEditor
            tempFixtureDir = tempDir

            return new Promise((resolve) => {
              const configWritePath = path.join(tempFixtureDir, path.basename(configPath))
              const wr = fs.createWriteStream(configWritePath)
              wr.on('close', () => {
                resolve()
              })
              fs.createReadStream(configPath).pipe(wr)
            })
          })
      )
    })

    afterEach(() => {
      rimraf.sync(tempFixtureDir)
    })

    it('should fix linting errors', () => {
      function firstLint(textEditor) {
        return lint(textEditor)
          .then((messages) => {
            // The original file has two errors
            expect(messages.length).toBe(2)
            return textEditor
          })
      }
      function makeFixes(textEditor) {
        return fix(textEditor)
          .then((messagesAfterSave) => {
            // Linter reports a successful fix
            expect(messagesAfterSave).toBe('Linter-ESLint: Fix complete.')
          })
      }
      // Create a subscription to watch when the editor changes (from the fix)
      editor.onDidChange(() => {
        lint(editor)
          .then((messagesAfterFixing) => {
            // Note: this fires several times, with only the final time resulting in
            // a non-null messagesAfterFixing.  This is the reason for the check here
            // and for the `waitsFor` which makes sure the expectation is tested.
            if (messagesAfterFixing) {
              // After opening the file again, there are no linting errors
              expect(messagesAfterFixing.length).toBe(0)
              doneCheckingFixes = true
            }
          })
      })

      waitsForPromise(() =>
        firstLint(editor)
          .then(makeFixes)
      )
      waitsFor(
        () => doneCheckingFixes,
        'Messages should be checked after fixing'
      )
    })

    xit('should not fix linting errors for rules that are disabled with rulesToDisableWhileFixing', () => {
      atom.config.set('linter-eslint.rulesToDisableWhileFixing', ['semi'])

      function firstLint(textEditor) {
        return lint(textEditor)
          .then((messages) => {
            // The original file has two errors
            expect(messages.length).toBe(2)
            return textEditor
          })
      }
      function makeFixes(textEditor) {
        return fix(textEditor)
          .then((messagesAfterSave) => {
            // Linter reports a successful fix
            expect(messagesAfterSave).toBe('Linter-ESLint: Fix complete.')
          })
      }
      // Create a subscription to watch when the editor changes (from the fix)
      editor.onDidChange(() => {
        lint(editor)
          .then((messagesAfterFixing) => {
            // Note: this fires several times, with only the final time resulting in
            // a non-null messagesAfterFixing.  This is the reason for the check here
            // and for the `waitsFor` which makes sure the expectation is tested.
            if (messagesAfterFixing) {
              // There is still one linting error, `semi` which was disabled during fixing
              expect(messagesAfterFixing.length).toBe(1)
              expect(messagesAfterFixing[0].html).toBe('Extra semicolon. (<a href="http://eslint.org/docs/rules/semi">semi</a>)')
              doneCheckingFixes = true
            }
          })
      })

      waitsForPromise(() =>
        firstLint(editor)
          .then(makeFixes)
      )
      waitsFor(
        () => doneCheckingFixes,
        'Messages should be checked after fixing'
      )
    })
  })

  describe('Ignores specified rules when editing', () => {
    const expected = 'Trailing spaces not allowed. ' +
      '(<a href="http://eslint.org/docs/rules/no-trailing-spaces">no-trailing-spaces</a>)'
    it('does nothing on saved files', () => {
      atom.config.set('linter-eslint.rulesToSilenceWhileTyping', ['no-trailing-spaces'])
      waitsForPromise(() =>
        atom.workspace.open(modifiedIgnoreSpacePath).then(editor =>
          lint(editor).then((messages) => {
            expect(messages.length).toBe(1)
            expect(messages[0].type).toBe('Error')
            expect(messages[0].text).not.toBeDefined()
            expect(messages[0].html).toBe(expected)
            expect(messages[0].filePath).toBe(modifiedIgnoreSpacePath)
            expect(messages[0].range).toEqual([[0, 9], [0, 10]])
          })
        )
      )
    })

    it('works when the file is modified', () => {
      let done

      // Set up an observer to check the editor once it is modified
      waitsForPromise(() =>
        atom.workspace.open(modifiedIgnorePath).then((editor) => {
          editor.onDidChange(() => {
            lint(editor).then((messages) => {
              if (messages) {
                // Verify the space is showing an error
                expect(messages.length).toBe(1)
                expect(messages[0].type).toBe('Error')
                expect(messages[0].text).not.toBeDefined()
                expect(messages[0].html).toBe(expected)
                expect(messages[0].filePath).toBe(modifiedIgnorePath)
                expect(messages[0].range).toEqual([[0, 9], [0, 10]])

                // Enable the option under test
                atom.config.set('linter-eslint.rulesToSilenceWhileTyping', ['no-trailing-spaces'])

                // Check the lint results
                lint(editor).then((newMessages) => {
                  expect(newMessages.length).toBe(0)
                  done = true
                })
              }
            })
          })

          // Verify no error before
          return lint(editor).then(messages =>
            expect(messages.length).toBe(0)
          )

          // Insert a space into the editor
          .then(() => {
            editor.getBuffer().insert([0, 9], ' ')
          })
        })
      )

      waitsFor(
        () => done,
        'Messages should be checked after modifying the buffer'
      )
    })
  })

  describe('prints debugging information with the `debug` command', () => {
    let editor
    beforeEach(() => {
      waitsForPromise(() =>
        atom.workspace.open(goodPath).then((openEditor) => {
          editor = openEditor
        })
      )
    })

    it('shows an info notification', () => {
      let done
      const checkNotificaton = (notification) => {
        if (notification.getMessage() === 'linter-eslint debugging information') {
          expect(notification.getType()).toEqual('info')
          done = true
        }
      }
      atom.notifications.onDidAddNotification(checkNotificaton)

      atom.commands.dispatch(atom.views.getView(editor), 'linter-eslint:debug')

      waitsFor(
        () => done,
        'Notification type should be checked',
        2000
      )
    })

    it('includes debugging information in the details', () => {
      let done
      const checkNotificaton = (notification) => {
        if (notification.getMessage() === 'linter-eslint debugging information') {
          const detail = notification.getDetail()
          expect(detail.includes(`Atom version: ${atom.getVersion()}`)).toBe(true)
          expect(detail.includes('linter-eslint version:')).toBe(true)
          expect(detail.includes(`Platform: ${process.platform}`)).toBe(true)
          expect(detail.includes('linter-eslint configuration:')).toBe(true)
          expect(detail.includes('Using local project ESLint')).toBe(true)
          done = true
        }
      }
      atom.notifications.onDidAddNotification(checkNotificaton)

      atom.commands.dispatch(atom.views.getView(editor), 'linter-eslint:debug')

      waitsFor(
        () => done,
        'Notification details should be checked',
        2000
      )
    })
  })

  it('handles ranges in messages', () =>
    waitsForPromise(() =>
      atom.workspace.open(endRangePath).then(editor =>
        lint(editor).then((messages) => {
          const expected = 'Unreachable code. ' +
            '(<a href="http://eslint.org/docs/rules/no-unreachable">no-unreachable</a>)'
          expect(messages[0].type).toBe('Error')
          expect(messages[0].text).not.toBeDefined()
          expect(messages[0].html).toBe(expected)
          expect(messages[0].filePath).toBe(endRangePath)
          expect(messages[0].range).toEqual([[5, 2], [6, 15]])
        })
      )
    )
  )

  describe('when setting `disableWhenNoEslintConfig` is false', () => {
    let editor
    let didError
    let gotLintingErrors
    let tempFixtureDir

    beforeEach(() => {
      atom.config.set('linter-eslint.disableWhenNoEslintConfig', false)

      waitsForPromise(() =>
        copyFileToTempDir(badInlinePath, tempFixtureDir)
          .then(({ openEditor, tempDir }) => {
            editor = openEditor
            tempFixtureDir = tempDir
          })
      )
    })

    afterEach(() => {
      rimraf.sync(tempFixtureDir)
    })

    it('errors when no config file is found', () => {
      lint(editor)
        .then((messages) => {
          // Older versions of ESLint will report an error
          // (or if current user running tests has a config in their home directory)
          const expectedHtml = '&#39;foo&#39; is not defined. ' +
            '(<a href="http://eslint.org/docs/rules/no-undef">no-undef</a>)'
          expect(messages.length).toBe(1)
          expect(messages[0].html).toBe(expectedHtml)
          gotLintingErrors = true
        })
        .catch((err) => {
          // Newer versions of ESLint will throw an exception
          expect(err.message).toBe('No ESLint configuration found.')
          didError = true
        })

      waitsFor(
        () => didError || gotLintingErrors,
        'An error should have been thrown or linting performed'
      )
    })
  })

  describe('when `disableWhenNoEslintConfig` is true', () => {
    let editor
    let tempFixtureDir

    beforeEach(() => {
      atom.config.set('linter-eslint.disableWhenNoEslintConfig', true)

      waitsForPromise(() =>
        copyFileToTempDir(badInlinePath)
          .then(({ openEditor, tempDir }) => {
            editor = openEditor
            tempFixtureDir = tempDir
          })
      )
    })

    afterEach(() => {
      rimraf.sync(tempFixtureDir)
    })

    it('does not report errors when no config file is found', () =>
      waitsForPromise(() =>
        lint(editor)
          .then((messages) => {
            expect(messages.length).toBe(0)
          })
      )
    )
  })
})
