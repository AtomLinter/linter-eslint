'use babel'

import { dirname } from 'path'
import { Module } from 'module'
import { findCached } from 'atom-linter'
import { passInMemo } from '../f-utils'

// Given a cached path and a directory, return the cache or a new valid
// node_modules directory based on the input. If new path found, then add
// it to Node's module path before returning.
//
export const getModulesDirAndRefreshCached = (cache = '', fileDir) => {
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
  Module._initPaths()

  // Return path for both consumer and caching
  return modulesDir
}

// Wrap in a memoizer to store and pass in the cache on each call.
//
const getModulesDirAndRefresh = passInMemo(getModulesDirAndRefreshCached)

export default getModulesDirAndRefresh
