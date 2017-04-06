'use babel'

import * as path from 'path'
import * as fs from 'fs'
import { tmpdir } from 'os'
import rimraf from 'rimraf'
import { beforeEach, it } from 'jasmine-fix'
// NOTE: If using fit you must add it to the list above!
import linterEslint from '../lib/main'

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
    const ws = fs.createWriteStream(tempFixturePath)
    ws.on('close', () =>
      atom.workspace.open(tempFixturePath).then((openEditor) => {
        resolve({ openEditor, tempDir: tempFixtureDir })
      })
    )
    fs.createReadStream(fileToCopyPath).pipe(ws)
  })
}

async function getNotification() {
  return new Promise((resolve) => {
    let notificationSub
    const newNotification = (notification) => {
      // Dispose of the notificaiton subscription
      notificationSub.dispose()
      resolve(notification)
    }
    // Subscribe to Atom's notifications
    notificationSub = atom.notifications.onDidAddNotification(newNotification)
  })
}

describe('The eslint provider for Linter', () => {
  const linterProvider = linterEslint.provideLinter()
  const lint = linterProvider.lint

  beforeEach(async () => {
    atom.config.set('linter-eslint.disableFSCache', false)
    atom.config.set('linter-eslint.disableEslintIgnore', true)

    // Activate the JavaScript language so Atom knows what the files are
    await atom.packages.activatePackage('language-javascript')
    // Activate the provider
    await atom.packages.activatePackage('linter-eslint')
  })

  describe('checks bad.js and', () => {
    let editor = null
    beforeEach(async () => {
      editor = await atom.workspace.open(badPath)
    })

    it('verifies the messages', async () => {
      const messages = await lint(editor)
      expect(messages.length).toBe(2)

      const expected0 = '&#39;foo&#39; is not defined. ' +
      '(<a href="http://eslint.org/docs/rules/no-undef">no-undef</a>)'
      const expected1 = 'Extra semicolon. ' +
        '(<a href="http://eslint.org/docs/rules/semi">semi</a>)'

      expect(messages[0].type).toBe('Error')
      expect(messages[0].text).not.toBeDefined()
      expect(messages[0].html).toBe(expected0)
      expect(messages[0].filePath).toBe(badPath)
      expect(messages[0].range).toEqual([[0, 0], [0, 3]])
      expect(messages[0].fix).not.toBeDefined()

      expect(messages[1].type).toBe('Error')
      expect(messages[1].text).not.toBeDefined()
      expect(messages[1].html).toBe(expected1)
      expect(messages[1].filePath).toBe(badPath)
      expect(messages[1].range).toEqual([[0, 8], [0, 9]])
      expect(messages[1].fix).toBeDefined()
      expect(messages[1].fix.range).toEqual([[0, 6], [0, 9]])
      expect(messages[1].fix.newText).toBe('42')
    })
  })

  it('finds nothing wrong with an empty file', async () => {
    const editor = await atom.workspace.open(emptyPath)
    const messages = await lint(editor)

    expect(messages.length).toBe(0)
  })

  it('finds nothing wrong with a valid file', async () => {
    const editor = await atom.workspace.open(goodPath)
    const messages = await lint(editor)

    expect(messages.length).toBe(0)
  })

  it('reports the fixes for fixable errors', async () => {
    const editor = await atom.workspace.open(fixPath)
    const messages = await lint(editor)

    expect(messages[0].fix.range).toEqual([[0, 10], [1, 8]])
    expect(messages[0].fix.newText).toBe('6\nfunction')

    expect(messages[1].fix.range).toEqual([[2, 0], [2, 1]])
    expect(messages[1].fix.newText).toBe('  ')
  })

  describe('when resolving import paths using eslint-plugin-import', () => {
    it('correctly resolves imports from parent', async () => {
      const editor = await atom.workspace.open(importingpath)
      const messages = await lint(editor)

      expect(messages.length).toBe(0)
    })

    it('shows a message for an invalid import', async () => {
      const editor = await atom.workspace.open(badImportPath)
      const messages = await lint(editor)
      const expected = 'Unable to resolve path to module &#39;../nonexistent&#39;. ' +
        '(<a href="https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-unresolved.md">' +
        'import/no-unresolved</a>)'

      expect(messages.length).toBe(1)
      expect(messages[0].type).toBe('Error')
      expect(messages[0].text).not.toBeDefined()
      expect(messages[0].html).toBe(expected)
      expect(messages[0].filePath).toBe(badImportPath)
      expect(messages[0].range).toEqual([[0, 24], [0, 39]])
      expect(messages[0].fix).not.toBeDefined()
    })
  })

  describe('when a file is specified in an .eslintignore file', () => {
    beforeEach(() => {
      atom.config.set('linter-eslint.disableEslintIgnore', false)
    })

    it('will not give warnings when linting the file', async () => {
      const editor = await atom.workspace.open(ignoredPath)
      const messages = await lint(editor)

      expect(messages.length).toBe(0)
    })

    it('will not give warnings when autofixing the file', async () => {
      const editor = await atom.workspace.open(ignoredPath)
      atom.commands.dispatch(atom.views.getView(editor), 'linter-eslint:fix-file')
      const notification = await getNotification()

      expect(notification.getMessage()).toBe('Linter-ESLint: Fix complete.')
    })
  })

  describe('fixes errors', () => {
    let editor
    let tempFixtureDir

    beforeEach(async () => {
      // Copy the file to a temporary folder
      const { openEditor, tempDir } = await copyFileToTempDir(fixPath)
      editor = openEditor
      tempFixtureDir = tempDir
      // Copy the config to the same temporary directory
      return new Promise((resolve) => {
        const configWritePath = path.join(tempDir, path.basename(configPath))
        const wr = fs.createWriteStream(configWritePath)
        wr.on('close', () => resolve())
        fs.createReadStream(configPath).pipe(wr)
      })
    })

    afterEach(() => {
      // Remove the temporary directory
      rimraf.sync(tempFixtureDir)
    })

    async function firstLint(textEditor) {
      const messages = await lint(textEditor)
      // The original file has two errors
      expect(messages.length).toBe(2)
    }

    async function makeFixes(textEditor) {
      return new Promise(async (resolve) => {
        // Subscribe to the file reload event
        const editorReloadSub = textEditor.getBuffer().onDidReload(async () => {
          editorReloadSub.dispose()
          // File has been reloaded in Atom, notification checking will happen
          // async either way, but should already be finished at this point
          resolve()
        })

        // Now that all the required subscriptions are active, send off a fix request
        atom.commands.dispatch(atom.views.getView(textEditor), 'linter-eslint:fix-file')
        const notification = await getNotification()

        expect(notification.getMessage()).toBe('Linter-ESLint: Fix complete.')
        expect(notification.getType()).toBe('success')
      })
    }

    it('should fix linting errors', async () => {
      await firstLint(editor)
      await makeFixes(editor)
      const messagesAfterFixing = await lint(editor)

      expect(messagesAfterFixing.length).toBe(0)
    })

    // NOTE: This actually works, but if both specs in this describe() are enabled
    // a bug within Atom is somewhat reliably triggered, so this needs to stay
    // disabled for now
    xit('should not fix linting errors for rules that are disabled with rulesToDisableWhileFixing', async () => {
      atom.config.set('linter-eslint.rulesToDisableWhileFixing', ['semi'])

      await firstLint(editor)
      await makeFixes(editor)
      const messagesAfterFixing = await lint(editor)
      const messageHTML = 'Extra semicolon. (<a href="http://eslint.org/docs/rules/semi">semi</a>)'

      expect(messagesAfterFixing.length).toBe(1)
      expect(messagesAfterFixing[0].html).toBe(messageHTML)
    })
  })

  describe('Ignores specified rules when editing', () => {
    const expected = 'Trailing spaces not allowed. ' +
      '(<a href="http://eslint.org/docs/rules/no-trailing-spaces">no-trailing-spaces</a>)'
    it('does nothing on saved files', async () => {
      atom.config.set('linter-eslint.rulesToSilenceWhileTyping', ['no-trailing-spaces'])
      const editor = await atom.workspace.open(modifiedIgnoreSpacePath)
      const messages = await lint(editor)

      expect(messages.length).toBe(1)
      expect(messages[0].type).toBe('Error')
      expect(messages[0].text).not.toBeDefined()
      expect(messages[0].html).toBe(expected)
      expect(messages[0].filePath).toBe(modifiedIgnoreSpacePath)
      expect(messages[0].range).toEqual([[0, 9], [0, 10]])
    })

    it('works when the file is modified', async () => {
      const editor = await atom.workspace.open(modifiedIgnorePath)

      // Verify no error before
      const firstMessages = await lint(editor)
      expect(firstMessages.length).toBe(0)

      // Insert a space into the editor
      editor.getBuffer().insert([0, 9], ' ')

      // Verify the space is showing an error
      const messages = await lint(editor)
      expect(messages.length).toBe(1)
      expect(messages[0].type).toBe('Error')
      expect(messages[0].text).not.toBeDefined()
      expect(messages[0].html).toBe(expected)
      expect(messages[0].filePath).toBe(modifiedIgnorePath)
      expect(messages[0].range).toEqual([[0, 9], [0, 10]])

      // Enable the option under test
      atom.config.set('linter-eslint.rulesToSilenceWhileTyping', ['no-trailing-spaces'])

      // Check the lint results
      const newMessages = await lint(editor)
      expect(newMessages.length).toBe(0)
    })
  })

  describe('prints debugging information with the `debug` command', () => {
    let editor
    beforeEach(async () => {
      editor = await atom.workspace.open(goodPath)
    })

    it('shows an info notification', async () => {
      atom.commands.dispatch(atom.views.getView(editor), 'linter-eslint:debug')
      const notification = await getNotification()

      expect(notification.getMessage()).toBe('linter-eslint debugging information')
      expect(notification.getType()).toEqual('info')
    })

    it('includes debugging information in the details', async () => {
      atom.commands.dispatch(atom.views.getView(editor), 'linter-eslint:debug')
      const notification = await getNotification()
      const detail = notification.getDetail()

      expect(detail.includes(`Atom version: ${atom.getVersion()}`)).toBe(true)
      expect(detail.includes('linter-eslint version:')).toBe(true)
      expect(detail.includes(`Platform: ${process.platform}`)).toBe(true)
      expect(detail.includes('linter-eslint configuration:')).toBe(true)
      expect(detail.includes('Using local project ESLint')).toBe(true)
    })
  })

  it('handles ranges in messages', async () => {
    const editor = await atom.workspace.open(endRangePath)
    const messages = await lint(editor)
    const expected = 'Unreachable code. ' +
      '(<a href="http://eslint.org/docs/rules/no-unreachable">no-unreachable</a>)'

    expect(messages[0].type).toBe('Error')
    expect(messages[0].text).not.toBeDefined()
    expect(messages[0].html).toBe(expected)
    expect(messages[0].filePath).toBe(endRangePath)
    expect(messages[0].range).toEqual([[5, 2], [6, 15]])
  })

  describe('when setting `disableWhenNoEslintConfig` is false', () => {
    let editor
    let tempFixtureDir

    beforeEach(async () => {
      atom.config.set('linter-eslint.disableWhenNoEslintConfig', false)

      const { openEditor, tempDir } = await copyFileToTempDir(badInlinePath)
      editor = openEditor
      tempFixtureDir = tempDir
    })

    afterEach(() => {
      rimraf.sync(tempFixtureDir)
    })

    it('errors when no config file is found', async () => {
      let didError
      let gotLintingErrors

      try {
        const messages = await lint(editor)
        // Older versions of ESLint will report an error
        // (or if current user running tests has a config in their home directory)
        const expectedHtml = '&#39;foo&#39; is not defined. ' +
        '(<a href="http://eslint.org/docs/rules/no-undef">no-undef</a>)'

        expect(messages.length).toBe(1)
        expect(messages[0].html).toBe(expectedHtml)
        gotLintingErrors = true
      } catch (err) {
        // Newer versions of ESLint will throw an exception
        expect(err.message).toBe('No ESLint configuration found.')
        didError = true
      }

      expect(didError || gotLintingErrors).toBe(true)
    })
  })

  describe('when `disableWhenNoEslintConfig` is true', () => {
    let editor
    let tempFixtureDir

    beforeEach(async () => {
      atom.config.set('linter-eslint.disableWhenNoEslintConfig', true)

      const { openEditor, tempDir } = await copyFileToTempDir(badInlinePath)
      editor = openEditor
      tempFixtureDir = tempDir
    })

    afterEach(() => {
      rimraf.sync(tempFixtureDir)
    })

    it('does not report errors when no config file is found', async () => {
      const messages = await lint(editor)

      expect(messages.length).toBe(0)
    })
  })
})
