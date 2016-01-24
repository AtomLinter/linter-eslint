'use strict'

const ChildProcess = require('child_process')
const Path = require('path')
const FS = require('fs')
const find = require('atom-linter').find

let prefixPath = null
const parentPath = FS.realpathSync(Path.join(__dirname, '..'))
const atomEslintPath = Path.join(parentPath, 'node_modules', 'eslint')

// Find directory of eslint installation. Traverse up the tree checking every
// `node_modules` directory
function findEslintDir(params) {
  if (!params.global) {
    return find(params.fileDir, 'node_modules/eslint') || atomEslintPath
  }

  if (params.nodePath === '' && prefixPath === null) {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    try {
      prefixPath = ChildProcess.spawnSync(npmCommand, ['get', 'prefix']).
        output[1].toString().trim()
    } catch (e) {
      throw new Error('Unable to execute `npm get prefix`. ' +
        'Please make sure Atom is getting $PATH correctly')
    }
  }

  return process.platform === 'win32'
    ? Path.join(params.nodePath || prefixPath, 'node_modules', 'eslint')
    : Path.join(params.nodePath || prefixPath, 'lib', 'node_modules', 'eslint')
}

// Check for project config file or eslint config in package.json and determine
// whether to bail out or use config specified in package options
function determineConfigFile(params) {
  // config file
  const configFileNames = [
    '.eslintrc.js',
    '.eslintrc.yaml',
    '.eslintrc.yml',
    '.eslintrc.json',
    '.eslintrc']
  const configFile = find(params.fileDir, configFileNames) || null
  if (configFile) {
    return configFile
  }
  // package.json
  const packagePath = find(params.fileDir, 'package.json')
  if (packagePath && Boolean(require(packagePath).eslintConfig)) {
    return packagePath
  }
  // Couldn't find a config
  if (params.canDisable) {
    return null
  }
  // If all else fails, use the configFile specified in the linter-eslint options
  if (params.configFile) {
    return params.configFile
  }
}

function getEslintCli(path) {
  try {
    const eslint = require(Path.join(path, 'lib', 'cli.js'))
    return eslint
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      throw new Error('ESLint not found, Please install or make sure Atom is ' +
        'getting $PATH correctly')
    } else throw e
  }
}


module.exports = {
  findEslintDir,
  find,
  determineConfigFile,
  getEslintCli
}
