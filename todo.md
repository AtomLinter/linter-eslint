# Todo

List of *specific* tasks to deal with. This is not intended as a broad-overview, but rather to show small individual list items that are planned for near upcoming commits, or have been noted, but skipped over, and need to be returned to later.

### Specs

* `cleanPath`
* `cdToProjectRoot` integration
  * This is a  simple composition  of functions that clearly behave as described.  So this should be low priority to write, but useful to have for high test-coverage and any future refactoring. Use specs from `getRelativePath` as a [Reference](reference), since they were theoretically supposed to be testing this integration.
* Memoizers

### Implicit dependencies

Some functions that are currently using implicit dependencies.

* `cdToFirstTruthy` requires `process`
* `getIgnore` requires `findCached`

### Reference

```javascript
describe('getRelativePath', () => {
  it('return path relative of ignore file if found', () => {
    const fixtureDir = getFixturesPath('eslintignore')
    const fixtureFile = Path.join(fixtureDir, 'ignored.js')
    const relativePath = Helpers.getRelativePath(fixtureDir, fixtureFile, {})
    const expectedPath = Path.relative(Path.join(__dirname, '..'), fixtureFile)
    expect(relativePath).toBe(expectedPath)
  })

  it('does not return path relative to ignore file if config overrides it', () => {
    const fixtureDir = getFixturesPath('eslintignore')
    const fixtureFile = Path.join(fixtureDir, 'ignored.js')
    const relativePath =
      Helpers.getRelativePath(fixtureDir, fixtureFile, { disableEslintIgnore: true })
    expect(relativePath).toBe('ignored.js')
  })

  it('returns the path relative to the project dir if provided when no ignore file is found', async () => {
    const fixtureFile = getFixturesPath(Path.join('files', 'good.js'))
    // Copy the file to a temporary folder
    const tempFixturePath = await copyFileToTempDir(fixtureFile)
    const tempDir = Path.dirname(tempFixturePath)
    const filepath = Path.join(tempDir, 'good.js')
    const tempDirParent = Path.dirname(tempDir)

    const relativePath = Helpers.getRelativePath(tempDir, filepath, {}, tempDirParent)
    // Since the project is the parent of the temp dir, the relative path should be
    // the dir containing the file, plus the file. (e.g. asgln3/good.js)
    const expectedPath = Path.join(Path.basename(tempDir), 'good.js')
    expect(relativePath).toBe(expectedPath)
    // Remove the temporary directory
    rimraf.sync(tempDir)
  })

  it('returns just the file being linted if no ignore file is found and no project dir is provided', async () => {
    const fixtureFile = getFixturesPath(Path.join('files', 'good.js'))
    // Copy the file to a temporary folder
    const tempFixturePath = await copyFileToTempDir(fixtureFile)
    const tempDir = Path.dirname(tempFixturePath)
    const filepath = Path.join(tempDir, 'good.js')

    const relativePath = Helpers.getRelativePath(tempDir, filepath, {}, null)
    expect(relativePath).toBe('good.js')

    // Remove the temporary directory
    rimraf.sync(tempDir)
  })
})
```
