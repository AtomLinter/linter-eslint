
const { findCached } = require('atom-linter')
const pipe = require('ramda/src/pipe')
const { maybeDirname } = require('./fs-utils')

// TODO remove implicit dependency on findCached
//
// Return null if ignore disabled, else upward-search for ignore file
//
const getIgnoreFile = ({ disableEslintIgnore, fileDir }) =>
  (disableEslintIgnore !== true
    ? findCached(fileDir, '.eslintignore')
    : null)

// Try to get directory of ignore file
//
const getIgnoreDir = pipe(getIgnoreFile, maybeDirname)

module.exports = {
  getIgnoreFile,
  getIgnoreDir
}
