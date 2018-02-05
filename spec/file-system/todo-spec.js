
const noOp = () => {}

describe('test for cleanPath', () => noOp)

// cdToProjectRoot  is a  simple composition  of functions that clearly behave
// as described.  So this should be low priority to write, but useful to have
// for high test-coverage and any future refactoring. Use disabled specs
// for getRelativePath (below) as a reference, since they were theoretically
// (although not actually ) testing this integration.
//
describe('integration test for cdToProjectRoot', noOp)

/** *********************
 * dependency injecton *
 ********************** */

// Several functions spotted that have implicit dependencies changing these
// to accept their dependencies as arguments will significantly alter  the
// testing required.
//

describe('fix cdToFirstTruthy implicit dependency on process', noOp)
describe('fix getIgnore implicit dependency on findCached', noOp)

/** ***********
 * Reference *
 ************ */

const getFixturesPath = noOp
const Path = {
  relative: noOp,
  join: noOp,
  dirname: noOp,
  basename: noOp
}
const Helpers = { getRelativePath: noOp }
const copyFileToTempDir = noOp
const rimraf = { sync: noOp }

xdescribe('getRelativePath', () => {
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
