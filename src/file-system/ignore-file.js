'use babel'

import { findCached } from 'atom-linter'
import { pipe } from '../f-utils/mini-ramda'
import { maybeDirname } from './fs-utils'

// TODO remove implicit dependency on findCached
//
// Return null if ignore disabled, else upward-search for ignore file
//
export const getIgnoreFile = ({ disableEslintIgnore, fileDir }) =>
  (disableEslintIgnore !== true
    ? findCached(fileDir, '.eslintignore')
    : null)

// Try to get directory of ignore file
//
export const dirToIgnoreDir = pipe(getIgnoreFile, maybeDirname)
