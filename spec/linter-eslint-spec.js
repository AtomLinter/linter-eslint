'use babel'

import * as path from 'path'
import * as fs from 'fs'
import { tmpdir } from 'os'
import rimraf from 'rimraf'
// eslint-disable-next-line no-unused-vars
import { beforeEach, it, fit } from 'jasmine-fix'
import linterEslint from '../src/main'

const fixturesDir = path.join(__dirname, 'fixtures')

const goodPath = path.join(fixturesDir, 'files', 'good.js')
const badPath = path.join(fixturesDir, 'files', 'bad.js')
const badInlinePath = path.join(fixturesDir, 'files', 'badInline.js')
const emptyPath = path.join(fixturesDir, 'files', 'empty.js')
const fixPath = path.join(fixturesDir, 'files', 'fix.js')
const cachePath = path.join(fixturesDir, 'files', '.eslintcache')
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
const badCachePath = path.join(fixturesDir, 'badCache')

/**
 * Async helper to copy a file from one place to another on the filesystem.
 * @param  {string} fileToCopyPath  Path of the file to be copied
 * @param  {string} destinationDir  Directory to paste the file into
 * @return {string}                 Full path of the file in copy destination
 */
function copyFileToDir(fileToCopyPath, destinationDir) {
  return new Promise((resolve) => {
    const destinationPath = path.join(destinationDir, path.basename(fileToCopyPath))
    const ws = fs.createWriteStream(destinationPath)
    ws.on('close', () => resolve(destinationPath))
    fs.createReadStream(fileToCopyPath).pipe(ws)
  })
}

/**
 * Utility helper to copy a file into the OS temp directory.
 *
 * @param  {string} fileToCopyPath  Path of the file to be copied
 * @return {string}                 Full path of the file in copy destination
 */
function copyFileToTempDir(fileToCopyPath) {
  return new Promise(async (resolve) => {
    const tempFixtureDir = fs.mkdtempSync(tmpdir() + path.sep)
    resolve(await copyFileToDir(fileToCopyPath, tempFixtureDir))
  })
}

async function getNotification(expectedMessage) {
  return new Promise((resolve) => {
    let notificationSub
    const newNotification = (notification) => {
      if (notification.getMessage() !== expectedMessage) {
        // As the specs execute asynchronously, it's possible a notification
        // from a different spec was grabbed, if the message doesn't match what
        // is expected simply return and keep waiting for the next message.
        return
      }
      // Dispose of the notificaiton subscription
      notificationSub.dispose()
      resolve(notification)
    }
    // Subscribe to Atom's notifications
    notificationSub = atom.notifications.onDidAddNotification(newNotification)
  })
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
    const expectedMessage = 'Linter-ESLint: Fix complete.'
    const notification = await getNotification(expectedMessage)

    expect(notification.getMessage()).toBe(expectedMessage)
    expect(notification.getType()).toBe('success')
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

      const expected0 = "'foo' is not defined. (no-undef)"
      const expected0Url = 'http://eslint.org/docs/rules/no-undef'
      const expected1 = 'Extra semicolon. (semi)'
      const expected1Url = 'http://eslint.org/docs/rules/semi'

      expect(messages[0].severity).toBe('error')
      expect(messages[0].excerpt).toBe(expected0)
      expect(messages[0].url).toBe(expected0Url)
      expect(messages[0].location.file).toBe(badPath)
      expect(messages[0].location.position).toEqual([[0, 0], [0, 3]])
      expect(messages[0].solutions).not.toBeDefined()

      expect(messages[1].severity).toBe('error')
      expect(messages[1].excerpt).toBe(expected1)
      expect(messages[1].url).toBe(expected1Url)
      expect(messages[1].location.file).toBe(badPath)
      expect(messages[1].location.position).toEqual([[0, 8], [0, 9]])
      expect(messages[1].solutions.length).toBe(1)
      expect(messages[1].solutions[0].position).toEqual([[0, 6], [0, 9]])
      expect(messages[1].solutions[0].replaceWith).toBe('42')
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

    expect(messages[0].solutions[0].position).toEqual([[0, 10], [1, 8]])
    expect(messages[0].solutions[0].replaceWith).toBe('6\nfunction')

    expect(messages[1].solutions[0].position).toEqual([[2, 0], [2, 1]])
    expect(messages[1].solutions[0].replaceWith).toBe('  ')
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
      const expected = "Unable to resolve path to module '../nonexistent'. (import/no-unresolved)"
      const expectedUrl = 'https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-unresolved.md'

      expect(messages.length).toBe(1)
      expect(messages[0].severity).toBe('error')
      expect(messages[0].excerpt).toBe(expected)
      expect(messages[0].url).toBe(expectedUrl)
      expect(messages[0].location.file).toBe(badImportPath)
      expect(messages[0].location.position).toEqual([[0, 24], [0, 39]])
      expect(messages[0].solutions).not.toBeDefined()
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
      const expectedMessage = 'Linter-ESLint: Fix complete.'
      const notification = await getNotification(expectedMessage)

      expect(notification.getMessage()).toBe(expectedMessage)
    })
  })

  describe('fixes errors', () => {
    let editor
    let tempDir

    beforeEach(async () => {
      // Copy the file to a temporary folder
      const tempFixturePath = await copyFileToTempDir(fixPath)
      editor = await atom.workspace.open(tempFixturePath)
      tempDir = path.dirname(tempFixturePath)
      // Copy the config to the same temporary directory
      await copyFileToDir(configPath, tempDir)
    })

    afterEach(() => {
      // Remove the temporary directory
      rimraf.sync(tempDir)
    })

    async function firstLint(textEditor) {
      const messages = await lint(textEditor)
      // The original file has two errors
      expect(messages.length).toBe(2)
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
      const expected = 'Extra semicolon. (semi)'
      const expectedUrl = 'http://eslint.org/docs/rules/semi'

      expect(messagesAfterFixing.length).toBe(1)
      expect(messagesAfterFixing[0].excerpt).toBe(expected)
      expect(messagesAfterFixing[0].url).toBe(expectedUrl)
    })
  })

  describe('when an eslint cache file is present', () => {
    let editor
    let tempDir

    beforeEach(async () => {
      // Copy the file to a temporary folder
      const tempFixturePath = await copyFileToTempDir(fixPath)
      editor = await atom.workspace.open(tempFixturePath)
      tempDir = path.dirname(tempFixturePath)
      // Copy the config to the same temporary directory
      await copyFileToDir(configPath, tempDir)
    })

    afterEach(() => {
      // Remove the temporary directory
      rimraf.sync(tempDir)
    })

    it('does not delete the cache file when performing fixes', async () => {
      const tempCacheFile = await copyFileToDir(cachePath, tempDir)
      const checkCachefileExists = () => {
        fs.statSync(tempCacheFile)
      }
      expect(checkCachefileExists).not.toThrow()
      await makeFixes(editor)
      expect(checkCachefileExists).not.toThrow()
    })
  })

  describe('Ignores specified rules when editing', () => {
    const expected = 'Trailing spaces not allowed. (no-trailing-spaces)'
    const expectedUrl = 'http://eslint.org/docs/rules/no-trailing-spaces'

    it('does nothing on saved files', async () => {
      atom.config.set('linter-eslint.rulesToSilenceWhileTyping', ['no-trailing-spaces'])
      const editor = await atom.workspace.open(modifiedIgnoreSpacePath)
      const messages = await lint(editor)

      expect(messages.length).toBe(1)
      expect(messages[0].severity).toBe('error')
      expect(messages[0].excerpt).toBe(expected)
      expect(messages[0].url).toBe(expectedUrl)
      expect(messages[0].location.file).toBe(modifiedIgnoreSpacePath)
      expect(messages[0].location.position).toEqual([[0, 9], [0, 10]])
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
      expect(messages[0].severity).toBe('error')
      expect(messages[0].excerpt).toBe(expected)
      expect(messages[0].url).toBe(expectedUrl)
      expect(messages[0].location.file).toBe(modifiedIgnorePath)
      expect(messages[0].location.position).toEqual([[0, 9], [0, 10]])

      // Enable the option under test
      atom.config.set('linter-eslint.rulesToSilenceWhileTyping', ['no-trailing-spaces'])

      // Check the lint results
      const newMessages = await lint(editor)
      expect(newMessages.length).toBe(0)
    })
  })

  describe('prints debugging information with the `debug` command', () => {
    let editor
    const expectedMessage = 'linter-eslint debugging information'
    beforeEach(async () => {
      editor = await atom.workspace.open(goodPath)
    })

    it('shows an info notification', async () => {
      atom.commands.dispatch(atom.views.getView(editor), 'linter-eslint:debug')
      const notification = await getNotification(expectedMessage)

      expect(notification.getMessage()).toBe(expectedMessage)
      expect(notification.getType()).toEqual('info')
    })

    it('includes debugging information in the details', async () => {
      atom.commands.dispatch(atom.views.getView(editor), 'linter-eslint:debug')
      const notification = await getNotification(expectedMessage)
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
    const expected = 'Unreachable code. (no-unreachable)'
    const expectedUrl = 'http://eslint.org/docs/rules/no-unreachable'

    expect(messages[0].severity).toBe('error')
    expect(messages[0].excerpt).toBe(expected)
    expect(messages[0].url).toBe(expectedUrl)
    expect(messages[0].location.file).toBe(endRangePath)
    expect(messages[0].location.position).toEqual([[5, 2], [6, 15]])
  })

  describe('when setting `disableWhenNoEslintConfig` is false', () => {
    let editor
    let tempFixtureDir

    beforeEach(async () => {
      atom.config.set('linter-eslint.disableWhenNoEslintConfig', false)

      const tempFilePath = await copyFileToTempDir(badInlinePath)
      editor = await atom.workspace.open(tempFilePath)
      tempFixtureDir = path.dirname(tempFilePath)
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
        const expected = "'foo' is not defined. (no-undef)"
        const expectedUrl = 'http://eslint.org/docs/rules/no-undef'
        expect(messages.length).toBe(1)
        expect(messages[0].excerpt).toBe(expected)
        expect(messages[0].url).toBe(expectedUrl)
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

      const tempFilePath = await copyFileToTempDir(badInlinePath)
      editor = await atom.workspace.open(tempFilePath)
      tempFixtureDir = path.dirname(tempFilePath)
    })

    afterEach(() => {
      rimraf.sync(tempFixtureDir)
    })

    it('does not report errors when no config file is found', async () => {
      const messages = await lint(editor)

      expect(messages.length).toBe(0)
    })
  })

  describe('lets ESLint handle configuration', () => {
    it('works when the cache fails', async () => {
      // Ensure the cache is enabled, since we will be taking advantage of
      // a failing in it's operation
      atom.config.set('linter-eslint.disableFSCache', false)
      const fooPath = path.join(badCachePath, 'temp', 'foo.js')
      const newConfigPath = path.join(badCachePath, 'temp', '.eslintrc.js')
      const editor = await atom.workspace.open(fooPath)
      function undefMsg(varName) {
        return `'${varName}' is not defined. (no-undef)`
      }
      const expectedUrl = 'http://eslint.org/docs/rules/no-undef'

      // Trigger a first lint to warm up the cache with the first config result
      let messages = await lint(editor)
      expect(messages.length).toBe(2)
      expect(messages[0].severity).toBe('error')
      expect(messages[0].excerpt).toBe(undefMsg('console'))
      expect(messages[0].url).toBe(expectedUrl)
      expect(messages[0].location.file).toBe(fooPath)
      expect(messages[0].location.position).toEqual([[1, 2], [1, 9]])
      expect(messages[1].severity).toBe('error')
      expect(messages[1].excerpt).toBe(undefMsg('bar'))
      expect(messages[1].url).toBe(expectedUrl)
      expect(messages[1].location.file).toBe(fooPath)
      expect(messages[1].location.position).toEqual([[1, 14], [1, 17]])

      // Write the new configuration file
      const newConfig = {
        env: {
          browser: true,
        },
      }
      let configContents = `module.exports = ${JSON.stringify(newConfig, null, 2)}\n`
      fs.writeFileSync(newConfigPath, configContents)

      // Lint again, ESLint should recognise the new configuration
      // The cached config results are still pointing at the _parent_ file. ESLint
      // would partially handle this situation if the config file was specified
      // from the cache.
      messages = await lint(editor)
      expect(messages.length).toBe(1)
      expect(messages[0].severity).toBe('error')
      expect(messages[0].excerpt).toBe(undefMsg('bar'))
      expect(messages[0].url).toBe(expectedUrl)
      expect(messages[0].location.file).toBe(fooPath)
      expect(messages[0].location.position).toEqual([[1, 14], [1, 17]])

      // Update the configuration
      newConfig.rules = {
        'no-undef': 'off',
      }
      configContents = `module.exports = ${JSON.stringify(newConfig, null, 2)}\n`
      fs.writeFileSync(newConfigPath, configContents)

      // Lint again, if the cache was specifying the file ESLint at this point
      // would fail to update the configuration fully, and would still report a
      // no-undef error.
      messages = await lint(editor)
      expect(messages.length).toBe(0)

      // Delete the temporary configuration file
      fs.unlinkSync(newConfigPath)
    })
  })

  describe('works with HTML files', () => {
    const embeddedScope = 'source.js.embedded.html'
    const scopes = linterProvider.grammarScopes

    it('adds the HTML scope when the setting is enabled', () => {
      expect(scopes.includes(embeddedScope)).toBe(false)
      atom.config.set('linter-eslint.lintHtmlFiles', true)
      expect(scopes.includes(embeddedScope)).toBe(true)
      atom.config.set('linter-eslint.lintHtmlFiles', false)
      expect(scopes.includes(embeddedScope)).toBe(false)
    })

    it('keeps the HTML scope with custom scopes', () => {
      expect(scopes.includes(embeddedScope)).toBe(false)
      atom.config.set('linter-eslint.lintHtmlFiles', true)
      expect(scopes.includes(embeddedScope)).toBe(true)
      atom.config.set('linter-eslint.scopes', ['foo.bar'])
      expect(scopes.includes(embeddedScope)).toBe(true)
    })
  })

  describe('handles the Show Rule ID in Messages option', () => {
    const expectedUrl = 'https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-unresolved.md'

    it('shows the rule ID when enabled', async () => {
      atom.config.set('linter-eslint.showRuleIdInMessage', true)
      const editor = await atom.workspace.open(badImportPath)
      const messages = await lint(editor)
      const expected = "Unable to resolve path to module '../nonexistent'. (import/no-unresolved)"

      expect(messages.length).toBe(1)
      expect(messages[0].severity).toBe('error')
      expect(messages[0].excerpt).toBe(expected)
      expect(messages[0].url).toBe(expectedUrl)
      expect(messages[0].location.file).toBe(badImportPath)
      expect(messages[0].location.position).toEqual([[0, 24], [0, 39]])
      expect(messages[0].solutions).not.toBeDefined()
    })

    it("doesn't show the rule ID when disabled", async () => {
      atom.config.set('linter-eslint.showRuleIdInMessage', false)
      const editor = await atom.workspace.open(badImportPath)
      const messages = await lint(editor)
      const expected = "Unable to resolve path to module '../nonexistent'."

      expect(messages.length).toBe(1)
      expect(messages[0].severity).toBe('error')
      expect(messages[0].excerpt).toBe(expected)
      expect(messages[0].url).toBe(expectedUrl)
      expect(messages[0].location.file).toBe(badImportPath)
      expect(messages[0].location.position).toEqual([[0, 24], [0, 39]])
      expect(messages[0].solutions).not.toBeDefined()
    })
  })
})
