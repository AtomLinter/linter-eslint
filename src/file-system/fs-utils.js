
const { findCached } = require('atom-linter')
const resolveEnv = require('resolve-env')
const { dirname, normalize } = require('path')

/** ***********************************
 *  Small, generic file system utilities *
 ************************************ */
/**
 * Takes a path and translates `~` to the user's home directory, and replaces
 * all environment variables with their value.
 * @param  {string} path The path to remove "strangeness" from
 * @return {string}      The cleaned path
 */
const cleanPath = path => (path ? resolveEnv(normalize(path)) : '')

// Change current working directory to provided  valid path
//
const cdToFirstTruthy = (paths) => {
  const target = paths.find(x => x)
  process.chdir(target)
  return target
}

// Call dirname with any string, else return null
//
const makeMaybeDirname = dir => file =>
  (file && typeof file === 'string'
    ? dir(file)
    : null)

// Preload dependencies
const maybeDirname = makeMaybeDirname(dirname)


// Get directory of a file located by findCached
//
const makeFindCachedDir = (dir, find) => (startingDir, filename) =>
  dir(find(startingDir, filename) || '')

const findCachedDir = makeFindCachedDir(dirname, findCached)

module.exports = {
  cleanPath,
  cdToFirstTruthy,
  makeMaybeDirname,
  maybeDirname,
  findCachedDir,
  makeFindCachedDir
}
