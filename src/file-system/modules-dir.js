
const { dirname } = require('path')
const { findCached } = require('atom-linter')
const bundledEslintPath = require('./bundled-eslint')
const { passInMemo } = require('../f-utils')

// Given a cached path and a directory, return the cache or a new valid
// node_modules directory based on the input. If new path found, then add
// it to Node's module path before returning.
//
const getModulesDirAndRefreshCached = (cache, fileDir) => {
  // If given an invalid directory, just send back cached path
  const eslintDir = findCached(fileDir, 'node_modules/eslint')
  if (!eslintDir) {
    return cache
  }

  // If path has not changed, we're done
  const modulesDir = dirname(eslintDir)
  if (modulesDir === cache) {
    return cache
  }

  // Slight hack to add path to Node's module search path
  process.env.NODE_PATH = modulesDir || ''
  // eslint-disable-next-line no-underscore-dangle
  require('module').Module._initPaths()

  // Return path for both consumer and caching
  return modulesDir
}

// Wrap in a memoizer to store and pass in the cache on each call.
//
const getModulesDirAndRefresh = passInMemo(getModulesDirAndRefreshCached)

// Prefill cache with bundled fallback
//
getModulesDirAndRefresh(bundledEslintPath())

module.exports = {
  getModulesDirAndRefresh,
  getModulesDirAndRefreshCached
}
