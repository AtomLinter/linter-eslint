'use babel'

import { findCached } from 'atom-linter'
import resolveEnv from 'resolve-env'
import { dirname, normalize } from 'path'

/** ***********************************
 *  Small, generic file system utilities *
 ************************************ */
/**
 * Takes a path and translates `~` to the user's home directory, and replaces
 * all environment variables with their value.
 * @param  {string} path The path to remove "strangeness" from
 * @return {string}      The cleaned path
 */
export const cleanPath = path => (path ? resolveEnv(normalize(path)) : '')

// Change current working directory to provided  valid path
//
export const cdToFirstTruthy = (paths) => {
  const target = paths.find(x => x)
  process.chdir(target)
  return target
}

// Call dirname with any string, else return null
//
export const makeMaybeDirname = dir => file =>
  (file && typeof file === 'string'
    ? dir(file)
    : null)

// Preload dependencies
export const maybeDirname = makeMaybeDirname(dirname)


// Get directory of a file located by findCached
//
export const makeFindCachedDir = (dir, find) => (startingDir, filename) =>
  dir(find(startingDir, filename) || '')

export const findCachedDir = makeFindCachedDir(dirname, findCached)
