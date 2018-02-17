'use babel'

import { join, isAbsolute } from 'path'
import { getNodePrefixPath, cleanPath, isDirectory } from '../file-system'

// Determine which settings to use for searching for ESLint
//
export const eslintDirType = ({
  useGlobalEslint,
  advancedLocalNodeModules
}) => {
  if (useGlobalEslint) {
    return 'global'
  } else if (advancedLocalNodeModules) {
    return 'advanced specified'
  }
  return 'local project'
}

// Try to start ESLint binary
//
export const getEslintInstance = (eslintDir) => {
  try {
    // eslint-disable-next-line import/no-dynamic-require
    return require(eslintDir)
  } catch (e) {
    throw new Error('ESLint not found, try restarting Atom to clear caches.')
  }
}

// Search for ESLint directory based of given type
//
export const findEslintDir = type => ({
  'local project': ({ modulesDir = '' }) => join(modulesDir, 'eslint'),

  global: ({ globalNodePath }) => {
    const prefixPath = cleanPath(globalNodePath) || getNodePrefixPath()
    const winDir = join(prefixPath, 'node_modules', 'eslint')
    return isDirectory(winDir)
      // NPM on Windows and Yarn on all platforms
      ? winDir
      // NPM on platforms other than Windows
      : join(prefixPath, 'lib', 'node_modules', 'eslint')
  },

  'advanced specified': ({
    advancedLocalNodeModules,
    projectPath
  }) => {
    const specifiedPath = join(cleanPath(advancedLocalNodeModules), 'eslint')
    return isAbsolute(specifiedPath)
      ? specifiedPath
      : join(projectPath, specifiedPath)
  },

})[type]
