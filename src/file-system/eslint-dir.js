'use babel'

import { join, path as isAbsolutePath } from 'path'

import bundledEslintPath from './bundled-eslint'
import { cleanPath } from './fs-utils'
import getNodePrefixPath from './node-prefix-path'
import { isDirectory } from '../validate/fs'

// Cascade through possible locations for ESLint directory
//
function findESLintDirectory({
  modulesDir,
  projectPath,
  useGlobalEslint,
  globalNodePath,
  advancedLocalNodeModules
}) {
  let eslintDir = null
  let locationType = null
  if (useGlobalEslint) {
    locationType = 'global'
    const configGlobal = cleanPath(globalNodePath)
    const prefixPath = configGlobal || getNodePrefixPath()
    // NPM on Windows and Yarn on all platforms
    eslintDir = join(prefixPath, 'node_modules', 'eslint')
    if (!isDirectory(eslintDir)) {
      // NPM on platforms other than Windows
      eslintDir = join(prefixPath, 'lib', 'node_modules', 'eslint')
    }
  } else if (!advancedLocalNodeModules) {
    locationType = 'local project'
    eslintDir = join(modulesDir || '', 'eslint')
  } else if (isAbsolutePath(cleanPath(advancedLocalNodeModules))) {
    locationType = 'advanced specified'
    eslintDir = join(cleanPath(advancedLocalNodeModules), 'eslint')
  } else {
    locationType = 'advanced specified'
    eslintDir = join(projectPath || '', cleanPath(advancedLocalNodeModules), 'eslint')
  }
  if (isDirectory(eslintDir)) {
    return {
      path: eslintDir,
      type: locationType,
    }
  } else if (useGlobalEslint) {
    throw new Error('ESLint not found, please ensure the global Node path is set correctly.')
  }
  return {
    path: bundledEslintPath(),
    type: 'bundled fallback',
  }
}

export default findESLintDirectory
