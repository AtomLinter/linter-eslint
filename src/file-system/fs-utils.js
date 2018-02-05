'use babel'

import resolveEnv from 'resolve-env'
import { dirname as pathDirname, normalize } from 'path'

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
export const makeMaybeDirname = dirname => file =>
  (file && typeof file === 'string'
    ? dirname(file)
    : null)

// Preload dependencies for
export const maybeDirname = makeMaybeDirname(pathDirname)
