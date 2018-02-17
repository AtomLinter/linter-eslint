# Todo

List of *specific* tasks to deal with. This is *not* intended as a broad-overview, but rather to show small individual list items that are planned for near upcoming commits, or have been noted, but skipped over, and need to be returned to later.

### Implicit dependencies

Some functions that are currently using implicit dependencies.

* `cdToFirstTruthy` requires `process`
* `getIgnore` requires `findCached`

### Other

* Centralize all `isLintDisabled` checks to `sendJob.js`. Cost is very low to wait until reaching `sendJob` and very high if we wait to check in worker.


### Specs

Except for deprecated specs, these functions should be mostly covered by the existing integration tests. Providing new specs for the smaller pieces should allow removing at-least-some of the existing integration tests, increasing code-coverage while reducing the overhead and time for running the test suite.

* `cleanPath` - Needs spec.
* `getModuleDirAndRefresh` - Needs spec
* `getESLintInstance` - Specs deprecated. Inspect tests for lost code coverage [Reference](reference)
* `getRelativePath` - Function deprecated. Inspect tests for lost code coverage [Reference](reference)
* `cdToProjectRoot` Simple composition, but an integration test would still be nice to have.
* Memoizers - Need specs

### Reference
```js
describe('getESLintInstance && getESLintFromDirectory', () => {
  const pathPart = join('testing', 'eslint', 'node_modules')

  it('tries to find an indirect local eslint using an absolute path', () => {
    const path = getFixturesPath('indirect-local-eslint', pathPart)
    const eslint = getESLintInstance({
      fileDir: '',
      useGlobalEslint: false,
      advancedLocalNodeModules: path
    })
    expect(eslint).toBe('located')
  })

  it('tries to find an indirect local eslint using a relative path', () => {
    const path = getFixturesPath('indirect-local-eslint', pathPart)
    const [projectPath, relativePath] = atom.project.relativizePath(path)

    const eslint = getESLintInstance({
      fileDir: '',
      useGlobalEslint: false,
      advancedLocalNodeModules: relativePath,
      projectPath
    })

    expect(eslint).toBe('located')
  })

  it('tries to find a local eslint', () => {
    const eslint = getESLintInstance({
      fileDir: getFixturesPath('local-eslint'),
    })
    expect(eslint).toBe('located')
  })

  // TODO Broken spec. Previously was throwing only because of calling
  // path.join with an object param. Needs to make temp folder outside project
  xit('cries if local eslint is not found', () => {
    expect(() => {
      getESLintInstance({
        fileDir: getFixturesPath('files'),
      })
    }).toThrow()
  })

  it('tries to find a global eslint if config is specified', () => {
    const eslint = getESLintInstance({
      fileDir: getFixturesPath('local-eslint'),
      useGlobalEslint: true,
      globalNodePath
    })
    expect(eslint).toBe('located')
  })

  it('cries if global eslint is not found', () => {
    expect(() => {
      getESLintInstance({
        fileDir: getFixturesPath('local-eslint'),
        useGlobalEslint: true,
        globalNodePath: getFixturesPath('files')
      })
    }).toThrow()
  })

  it('tries to find a local eslint with nested node_modules', () => {
    const fileDir = getFixturesPath('local-eslint', 'lib', 'foo.js')
    const eslint = getESLintInstance({ fileDir })
    expect(eslint).toBe('located')
  })
```


```js
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
