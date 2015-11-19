'use strict';

const ChildProcess = require('child_process')
const Path = require('path')
const FS = require('fs')

let prefixPath = null

function find(startDir, names) {
  let localNames;
  if (typeof names === 'string') {
    localNames = [names]
  } else {
    localNames = names
  }
  const chunks = startDir.split(Path.sep)
  while (chunks.length) {
    const currentDirectory = Path.join(chunks.join(Path.sep))
    for (let index = 0; index < localNames.length; index++) {
      const filePath = Path.join(currentDirectory, localNames[index])
      try {
        FS.accessSync(filePath, FS.R_OK)
        return filePath
      } catch (_) { }
    }

    chunks.pop()
  }
  return null
}

function findEslintDir(params) {
  const eslintPathLocal = Path.join(FS.realpathSync(Path.join(__dirname, '..')), 'node_modules', 'eslint')
  const modulesPath = find(params.fileDir, 'node_modules')
  let eslintNewPath = null

  if (params.global) {
    if (params.nodePath === '' && prefixPath === null) {
      const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
      try {
        prefixPath = ChildProcess.spawnSync(npmCommand, ['get', 'prefix']).output[1].toString().trim()
      } catch (e) {
        throw new Error('Unable to execute `npm get prefix`. Please make sure Atom is getting $PATH correctly')
      }
    }
    if (process.platform === 'win32') {
      eslintNewPath = Path.join(params.nodePath || prefixPath, 'node_modules', 'eslint')
    } else {
      eslintNewPath = Path.join(params.nodePath || prefixPath, 'lib', 'node_modules', 'eslint')
    }
  } else {
    try {
      FS.accessSync(eslintNewPath = Path.join(modulesPath, 'eslint'), FS.R_OK)
    } catch (_) {
      eslintNewPath = eslintPathLocal
    }
  }

  return eslintNewPath
}

// Check for project config file or eslint config in package.json and determine
// whether to bail out or use config specified in package options
function determineConfigFile(params) {
  // config file
  const configFile = find(params.fileDir, ['eslintrc.js', '.eslintrc.yaml', '.eslintrc.yml', '.eslintrc.json', '.eslintrc']) || null
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
      throw new Error('ESLint not found, Please install or make sure Atom is getting $PATH correctly')
    } else throw e
  }
}


module.exports = {
  findEslintDir: findEslintDir,
  find: find,
  determineConfigFile: determineConfigFile,
  getEslintCli: getEslintCli
}
