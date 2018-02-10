
const pipe = require('ramda/src/pipe')
const { getIgnoreDir } = require('./ignore-file')
const { cdToFirstTruthy } = require('./fs-utils')

// Transform list of props describing project roots into array
// of project root possibilities sorted by which should take priority
// if it exists.
//
const makeGetRootPaths = getIgnDir => ({
  disableEslintIgnore,
  projectPath,
  fileDir
}) => ([
  getIgnDir({ disableEslintIgnore, fileDir }),
  projectPath,
  fileDir
])

// Preload dependencies for more convenient use
const getRootPaths = makeGetRootPaths(getIgnoreDir)

/**
 * Create side-effect of changing working directory, based on props provided.
 * Optionally retrieves ignore file, then chooses first matching directory from
 * list of [ignore-file-location, provided-project-path, linted-file-location]
 *
 * @type {[type]}
 * @param {[object]} props   {  disableEslintIgnore, projectPath, fileDir }
 * @property {boolean} [props.disableEslintIgnore]  whether to disable ignore
 * @property {string} [props.projectPath] a predetermined project root path
 * @property {string} [props.fileDir] directory of file to be linted
 * @return {string} the path which process.chdir was called with
 */
const cdToProjectRoot = pipe(getRootPaths, cdToFirstTruthy)

module.exports = {
  cdToProjectRoot,
  makeGetRootPaths,
  getRootPaths,
}
