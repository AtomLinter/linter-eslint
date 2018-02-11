'use babel'

import { pipe } from '../f-utils/mini-ramda'
import { dirToIgnoreDir } from './ignore-file'
import { cdToFirstTruthy } from './fs-utils'

// Transform list of props describing project roots into array
// of project root possibilities sorted by which should take priority
// if it exists.
//
export const makeGetRootPaths = dirToIgnDir => ({
  disableEslintIgnore,
  projectPath,
  fileDir
}) => ([
  dirToIgnDir({ disableEslintIgnore, fileDir }),
  projectPath,
  fileDir
])

// Preload dependencies for more convenient use
export const getRootPaths = makeGetRootPaths(dirToIgnoreDir)

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

export default cdToProjectRoot
