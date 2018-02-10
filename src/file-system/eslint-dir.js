
const { join, path: isAbsolutePath } = require('path')

const bundledEslintPath = require('./bundled-eslint')
const { cleanPath } = require('./fs-utils')
const getNodePrefixPath = require('./node-prefix-path')
const { isDirectory } = require('../validate/fs')

// Cascade through possible locations for ESLint directory
//
function findEslintDir({
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


const findEslintDirCurried = props => modulesDir =>
  findEslintDir(Object.assign({}, props, { modulesDir }))

module.exports = {
  findEslintDir,
  findEslintDirCurried
}
