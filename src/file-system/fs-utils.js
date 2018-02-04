'use babel'

import resolveEnv from 'resolve-env'
import { normalize } from 'fs-plus'

/** ***********************************
 *  Small, generic file system utilities *
 ************************************ */

/**
 * Takes a path and translates `~` to the user's home directory, and replaces
 * all environment variables with their value.
 * @param  {string} path The path to remove "strangeness" from
 * @return {string}      The cleaned path
 */
// eslint-disable-next-line import/prefer-default-export
export const cleanPath = path => (path ? resolveEnv(normalize(path)) : '')
