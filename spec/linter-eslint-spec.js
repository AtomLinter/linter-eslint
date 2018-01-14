'use babel'

import * as path from 'path'
import * as fs from 'fs'
import { tmpdir } from 'os'
import rimraf from 'rimraf'
// eslint-disable-next-line no-unused-vars
import { beforeEach, it, fit } from 'jasmine-fix'
import linterEslint from '../src/main'

const fixturesDir = path.join(__dirname, 'fixtures')

const fixtures = {
  good: ['files', 'good.js'],
  bad: ['files', 'bad.js'],
  badInline: ['files', 'badInline.js'],
  empty: ['files', 'empty.js'],
  fix: ['files', 'fix.js'],
  cache: ['files', '.eslintcache'],
  config: ['configs', '.eslintrc.yml'],
  ignored: ['eslintignore', 'ignored.js'],
  endRange: ['end-range', 'no-unreachable.js'],
  badCache: ['badCache'],
  modifiedIgnore: ['modified-ignore-rule', 'foo.js'],
  modifiedIgnoreSpace: ['modified-ignore-rule', 'foo-space.js'],
  importing: ['import-resolution', 'nested', 'importing.js'],
  badImport: ['import-resolution', 'nested', 'badImport.js'],
  fixablePlugin: ['plugin-import', 'life.js'],
  eslintignoreDir: ['eslintignore'],
  eslintIgnoreKeyDir: ['configs', 'eslintignorekey']
}

const paths = Object.keys(fixtures)
  .reduce((accumulator, fixture) => {
    const acc = accumulator
    acc[fixture] = path.join(fixturesDir, ...(fixtures[fixture]))
    return acc
  }, {})

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
// eslint-disable-next-line import/prefer-default-export
export async function copyFileToTempDir(fileToCopyPath) {
  const tempFixtureDir = fs.mkdtempSync(tmpdir() + path.sep)
  return copyFileToDir(fileToCopyPath, tempFixtureDir)
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
      // Dispose of the notification subscription
      notificationSub.dispose()
      resolve(notification)
    }
    // Subscribe to Atom's notifications
    notificationSub = atom.notifications.onDidAddNotification(newNotification)
  })
}

async function makeFixes(textEditor) {
  const editorReloadPromise = new Promise((resolve) => {
    // Subscribe to file reload events
    const editorReloadSubscription = textEditor.getBuffer().onDidReload(() => {
      editorReloadSubscription.dispose()
      resolve()
    })
  })

  const expectedMessage = 'Linter-ESLint: Fix complete.'
  // Subscribe to notification events
  const notificationPromise = getNotification(expectedMessage)

  // Subscriptions now active for Editor Reload and Message Notification
  // Send off a fix request.
  atom.commands.dispatch(atom.views.getView(textEditor), 'linter-eslint:fix-file')

  const notification = await notificationPromise
  expect(notification.getMessage()).toBe(expectedMessage)
  expect(notification.getType()).toBe('success')

  // After editor reloads, it should be safe for consuming test to resume.
  return editorReloadPromise
}

describe('The eslint provider for Linter', () => {
  const linterProvider = linterEslint.provideLinter()
  const { lint } = linterProvider

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
      editor = await atom.workspace.open(paths.bad)
    })

    it('verifies the messages', async () => {
      const messages = await lint(editor)
      expect(messages.length).toBe(2)

      const expected0 = "'foo' is not defined. (no-undef)"
      const expected0Url = 'https://eslint.org/docs/rules/no-undef'
      const expected1 = 'Extra semicolon. (semi)'
      const expected1Url = 'https://eslint.org/docs/rules/semi'

      expect(messages[0].severity).toBe('error')
      expect(messages[0].excerpt).toBe(expected0)
      expect(messages[0].url).toBe(expected0Url)
      expect(messages[0].location.file).toBe(paths.bad)
      expect(messages[0].location.position).toEqual([[0, 0], [0, 3]])
      expect(messages[0].solutions).not.toBeDefined()

      expect(messages[1].severity).toBe('error')
      expect(messages[1].excerpt).toBe(expected1)
      expect(messages[1].url).toBe(expected1Url)
      expect(messages[1].location.file).toBe(paths.bad)
      expect(messages[1].location.position).toEqual([[0, 8], [0, 9]])
      expect(messages[1].solutions.length).toBe(1)
      expect(messages[1].solutions[0].position).toEqual([[0, 6], [0, 9]])
      expect(messages[1].solutions[0].replaceWith).toBe('42')
    })
  })

  it('finds nothing wrong with an empty file', async () => {
    const editor = await atom.workspace.open(paths.empty)
    const messages = await lint(editor)

    expect(messages.length).toBe(0)
  })

  it('finds nothing wrong with a valid file', async () => {
    const editor = await atom.workspace.open(paths.good)
    const messages = await lint(editor)

    expect(messages.length).toBe(0)
  })

  it('reports the fixes for fixable errors', async () => {
    const editor = await atom.workspace.open(paths.fix)
    const messages = await lint(editor)

    expect(messages[0].solutions[0].position).toEqual([[0, 10], [1, 8]])
    expect(messages[0].solutions[0].replaceWith).toBe('6\nfunction')

    expect(messages[1].solutions[0].position).toEqual([[2, 0], [2, 1]])
    expect(messages[1].solutions[0].replaceWith).toBe('  ')
  })

  describe('when resolving import paths using eslint-plugin-import', () => {
    it('correctly resolves imports from parent', async () => {
      const editor = await atom.workspace.open(paths.importing)
      const messages = await lint(editor)

      expect(messages.length).toBe(0)
    })

    it('shows a message for an invalid import', async () => {
      const editor = await atom.workspace.open(paths.badImport)
      const messages = await lint(editor)
      const expected = "Unable to resolve path to module '../nonexistent'. (import/no-unresolved)"
      const expectedUrl = 'https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-unresolved.md'

      expect(messages.length).toBe(1)
      expect(messages[0].severity).toBe('error')
      expect(messages[0].excerpt).toBe(expected)
      expect(messages[0].url).toBe(expectedUrl)
      expect(messages[0].location.file).toBe(paths.badImport)
      expect(messages[0].location.position).toEqual([[0, 24], [0, 40]])
      expect(messages[0].solutions).not.toBeDefined()
    })
  })

  describe('when a file is specified in an .eslintignore file', () => {
    beforeEach(() => {
      atom.config.set('linter-eslint.disableEslintIgnore', false)
    })

    it('will not give warnings when linting the file', async () => {
      const editor = await atom.workspace.open(paths.ignored)
      const messages = await lint(editor)

      expect(messages.length).toBe(0)
    })

    it('will not give warnings when autofixing the file', async () => {
      const editor = await atom.workspace.open(paths.ignored)
      const expectedMessage = 'Linter-ESLint: Fix complete.'
      const notificationPromise = getNotification(expectedMessage)
      atom.commands.dispatch(atom.views.getView(editor), 'linter-eslint:fix-file')
      const notification = await notificationPromise

      expect(notification.getMessage()).toBe(expectedMessage)
    })
  })

  describe('when a file is not specified in .eslintignore file', async () => {
    it('will give warnings when linting the file', async () => {
      const tempPath = await copyFileToTempDir(path.join(paths.eslintignoreDir, 'ignored.js'))
      const tempDir = path.dirname(tempPath)

      const editor = await atom.workspace.open(tempPath)
      atom.config.set('linter-eslint.disableEslintIgnore', false)
      await copyFileToDir(path.join(paths.eslintignoreDir, '.eslintrc.yaml'), tempDir)

      const messages = await lint(editor)
      expect(messages.length).toBe(1)
      rimraf.sync(tempDir)
    })
  })

  describe('when a file is specified in an eslintIgnore key in package.json', () => {
    it('will still lint the file if an .eslintignore file is present', async () => {
      atom.config.set('linter-eslint.disableEslintIgnore', false)
      const editor = await atom.workspace.open(path.join(paths.eslintIgnoreKeyDir, 'ignored.js'))
      const messages = await lint(editor)

      expect(messages.length).toBe(1)
    })

    it('will not give warnings when linting the file', async () => {
      const tempPath = await copyFileToTempDir(path.join(paths.eslintIgnoreKeyDir, 'ignored.js'))
      const tempDir = path.dirname(tempPath)

      const editor = await atom.workspace.open(tempPath)
      atom.config.set('linter-eslint.disableEslintIgnore', false)
      await copyFileToDir(path.join(paths.eslintIgnoreKeyDir, 'package.json'), tempDir)

      const messages = await lint(editor)
      expect(messages.length).toBe(0)
      rimraf.sync(tempDir)
    })
  })

  describe('fixes errors', () => {
    let editor
    let tempDir

    beforeEach(async () => {
      // Copy the file to a temporary folder
      const tempFixturePath = await copyFileToTempDir(paths.fix)
      editor = await atom.workspace.open(tempFixturePath)
      tempDir = path.dirname(tempFixturePath)
      // Copy the config to the same temporary directory
      await copyFileToDir(paths.config, tempDir)
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

    it('should not fix linting errors for rules that are disabled with rulesToDisableWhileFixing', async () => {
      atom.config.set('linter-eslint.rulesToDisableWhileFixing', ['semi'])

      await firstLint(editor)
      await makeFixes(editor)
      const messagesAfterFixing = await lint(editor)
      const expected = 'Extra semicolon. (semi)'
      const expectedUrl = 'https://eslint.org/docs/rules/semi'

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
      const tempFixturePath = await copyFileToTempDir(paths.fix)
      editor = await atom.workspace.open(tempFixturePath)
      tempDir = path.dirname(tempFixturePath)
      // Copy the config to the same temporary directory
      await copyFileToDir(paths.config, tempDir)
    })

    afterEach(() => {
      // Remove the temporary directory
      rimraf.sync(tempDir)
    })

    it('does not delete the cache file when performing fixes', async () => {
      const tempCacheFile = await copyFileToDir(paths.cache, tempDir)
      const checkCachefileExists = () => {
        fs.statSync(tempCacheFile)
      }
      expect(checkCachefileExists).not.toThrow()
      await makeFixes(editor)
      expect(checkCachefileExists).not.toThrow()
    })
  })

  describe('Ignores specified rules when editing', () => {
    let expectedPath

    const checkNoConsole = (message) => {
      const text = 'Unexpected console statement. (no-console)'
      const url = 'https://eslint.org/docs/rules/no-console'
      expect(message.severity).toBe('error')
      expect(message.excerpt).toBe(text)
      expect(message.url).toBe(url)
      expect(message.location.file).toBe(expectedPath)
      expect(message.location.position).toEqual([[0, 0], [0, 11]])
    }

    const checkNoTrailingSpace = (message) => {
      const text = 'Trailing spaces not allowed. (no-trailing-spaces)'
      const url = 'https://eslint.org/docs/rules/no-trailing-spaces'

      expect(message.severity).toBe('error')
      expect(message.excerpt).toBe(text)
      expect(message.url).toBe(url)
      expect(message.location.file).toBe(expectedPath)
      expect(message.location.position).toEqual([[1, 9], [1, 10]])
    }

    const checkBefore = (messages) => {
      expect(messages.length).toBe(1)
      checkNoConsole(messages[0])
    }

    const checkNew = (messages) => {
      expect(messages.length).toBe(2)
      checkNoConsole(messages[0])
      checkNoTrailingSpace(messages[1])
    }

    const checkAfter = (messages) => {
      expect(messages.length).toBe(1)
      checkNoConsole(messages[0])
    }

    it('does nothing on saved files', async () => {
      atom.config.set('linter-eslint.rulesToSilenceWhileTyping', ['no-trailing-spaces'])
      atom.config.set('linter-eslint.ignoreFixableRulesWhileTyping', true)
      expectedPath = paths.modifiedIgnoreSpace
      const editor = await atom.workspace.open(expectedPath)
      // Run once to populate the fixable rules list
      await lint(editor)
      // Run again for the testable results
      const messages = await lint(editor)
      checkNew(messages)
    })

    it('allows ignoring a specific list of rules when modified', async () => {
      expectedPath = paths.modifiedIgnore
      const editor = await atom.workspace.open(expectedPath)

      // Verify expected error before
      const firstMessages = await lint(editor)
      checkBefore(firstMessages)

      // Insert a space into the editor
      editor.getBuffer().insert([1, 9], ' ')

      // Verify the space is showing an error
      const messages = await lint(editor)
      checkNew(messages)

      // Enable the option under test
      atom.config.set('linter-eslint.rulesToSilenceWhileTyping', ['no-trailing-spaces'])

      // Check the lint results
      const newMessages = await lint(editor)
      checkAfter(newMessages)
    })

    it('allows ignoring all fixable rules while typing', async () => {
      expectedPath = paths.modifiedIgnore
      const editor = await atom.workspace.open(expectedPath)

      // Verify no error before
      const firstMessages = await lint(editor)
      checkBefore(firstMessages)

      // Insert a space into the editor
      editor.getBuffer().insert([1, 9], ' ')

      // Verify the space is showing an error
      const messages = await lint(editor)
      checkNew(messages)

      // Enable the option under test
      // NOTE: Depends on no-trailing-spaces being marked as fixable by ESLint
      atom.config.set('linter-eslint.ignoreFixableRulesWhileTyping', true)

      // Check the lint results
      const newMessages = await lint(editor)
      checkAfter(newMessages)
    })

    it('allows ignoring fixible rules from plugins while typing', async () => {
      expectedPath = paths.fixablePlugin
      const editor = await atom.workspace.open(expectedPath)

      // Verify no error before the editor is modified
      const firstMessages = await lint(editor)
      expect(firstMessages.length).toBe(0)

      // Remove the newline between the import and console log
      editor.getBuffer().deleteRow(1)

      // Verify there is an error for the fixable import/newline-after-import rule
      const messages = await lint(editor)
      expect(messages.length).toBe(1)
      expect(messages[0].severity).toBe('error')
      expect(messages[0].excerpt).toBe('Expected empty line after import statement not followed by another import. (import/newline-after-import)')

      // Enable the option under test
      // NOTE: Depends on mport/newline-after-import rule being marked as fixable
      atom.config.set('linter-eslint.ignoreFixableRulesWhileTyping', true)

      // Check the lint results
      const newMessages = await lint(editor)
      expect(newMessages.length).toBe(0)
    })
  })

  describe('prints debugging information with the `debug` command', () => {
    let editor
    const expectedMessage = 'linter-eslint debugging information'
    beforeEach(async () => {
      editor = await atom.workspace.open(paths.good)
    })

    it('shows an info notification', async () => {
      const notificationPromise = getNotification(expectedMessage)
      atom.commands.dispatch(atom.views.getView(editor), 'linter-eslint:debug')
      const notification = await notificationPromise

      expect(notification.getMessage()).toBe(expectedMessage)
      expect(notification.getType()).toEqual('info')
    })

    it('includes debugging information in the details', async () => {
      const notificationPromise = getNotification(expectedMessage)
      atom.commands.dispatch(atom.views.getView(editor), 'linter-eslint:debug')
      const notification = await notificationPromise
      const detail = notification.getDetail()

      expect(detail.includes(`Atom version: ${atom.getVersion()}`)).toBe(true)
      expect(detail.includes('linter-eslint version:')).toBe(true)
      expect(detail.includes(`Platform: ${process.platform}`)).toBe(true)
      expect(detail.includes('linter-eslint configuration:')).toBe(true)
      expect(detail.includes('Using local project ESLint')).toBe(true)
    })
  })

  it('handles ranges in messages', async () => {
    const editor = await atom.workspace.open(paths.endRange)
    const messages = await lint(editor)
    const expected = 'Unreachable code. (no-unreachable)'
    const expectedUrl = 'https://eslint.org/docs/rules/no-unreachable'

    expect(messages[0].severity).toBe('error')
    expect(messages[0].excerpt).toBe(expected)
    expect(messages[0].url).toBe(expectedUrl)
    expect(messages[0].location.file).toBe(paths.endRange)
    expect(messages[0].location.position).toEqual([[5, 2], [6, 15]])
  })

  describe('when setting `disableWhenNoEslintConfig` is false', () => {
    let editor
    let tempFilePath
    let tempFixtureDir

    beforeEach(async () => {
      atom.config.set('linter-eslint.disableWhenNoEslintConfig', false)

      tempFilePath = await copyFileToTempDir(paths.badInline)
      editor = await atom.workspace.open(tempFilePath)
      tempFixtureDir = path.dirname(tempFilePath)
    })

    afterEach(() => {
      rimraf.sync(tempFixtureDir)
    })

    it('errors when no config file is found', async () => {
      const messages = await lint(editor)
      const expected = 'Error while running ESLint: No ESLint configuration found..'
      const description = `<div style="white-space: pre-wrap">No ESLint configuration found.
<hr />Error: No ESLint configuration found.
    at Config.getLocalConfigHierarchy`
      // The rest of the description includes paths specific to the computer running it
      expect(messages.length).toBe(1)
      expect(messages[0].severity).toBe('error')
      expect(messages[0].excerpt).toBe(expected)
      expect(messages[0].description.startsWith(description)).toBe(true)
      expect(messages[0].url).not.toBeDefined()
      expect(messages[0].location.file).toBe(tempFilePath)
      expect(messages[0].location.position).toEqual([[0, 0], [0, 28]])
    })
  })

  describe('when `disableWhenNoEslintConfig` is true', () => {
    let editor
    let tempFixtureDir

    beforeEach(async () => {
      atom.config.set('linter-eslint.disableWhenNoEslintConfig', true)

      const tempFilePath = await copyFileToTempDir(paths.badInline)
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
      const fooPath = path.join(paths.badCache, 'temp', 'foo.js')
      const newConfigPath = path.join(paths.badCache, 'temp', '.eslintrc.js')
      const editor = await atom.workspace.open(fooPath)
      function undefMsg(varName) {
        return `'${varName}' is not defined. (no-undef)`
      }
      const expectedUrl = 'https://eslint.org/docs/rules/no-undef'

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
      const editor = await atom.workspace.open(paths.badImport)
      const messages = await lint(editor)
      const expected = "Unable to resolve path to module '../nonexistent'. (import/no-unresolved)"

      expect(messages.length).toBe(1)
      expect(messages[0].severity).toBe('error')
      expect(messages[0].excerpt).toBe(expected)
      expect(messages[0].url).toBe(expectedUrl)
      expect(messages[0].location.file).toBe(paths.badImport)
      expect(messages[0].location.position).toEqual([[0, 24], [0, 40]])
      expect(messages[0].solutions).not.toBeDefined()
    })

    it("doesn't show the rule ID when disabled", async () => {
      atom.config.set('linter-eslint.showRuleIdInMessage', false)
      const editor = await atom.workspace.open(paths.badImport)
      const messages = await lint(editor)
      const expected = "Unable to resolve path to module '../nonexistent'."

      expect(messages.length).toBe(1)
      expect(messages[0].severity).toBe('error')
      expect(messages[0].excerpt).toBe(expected)
      expect(messages[0].url).toBe(expectedUrl)
      expect(messages[0].location.file).toBe(paths.badImport)
      expect(messages[0].location.position).toEqual([[0, 24], [0, 40]])
      expect(messages[0].solutions).not.toBeDefined()
    })
  })

  describe("registers an 'ESLint Fix' right click menu command", () => {
    // NOTE: Reaches into the private data of the ContextMenuManager, there is
    // no public method to check this though so...
    expect(atom.contextMenu.itemSets.some(itemSet =>
      // Matching selector...
      itemSet.selector === 'atom-text-editor:not(.mini), .overlayer' &&
      itemSet.items.some(item =>
        // Matching command...
        item.command === 'linter-eslint:fix-file' &&
        // Matching label
        item.label === 'ESLint Fix' &&
        // And has a function controlling display
        typeof item.shouldDisplay === 'function')))
  })
})
