'use babel'

import Path from 'path'
import FS from 'fs'
import ChildProcess from 'child_process'
import {findCached} from 'atom-linter'

const Cache = {
  ESLINT_LOCAL_PATH: Path.normalize(__dirname, '..', 'node_modules', 'eslint'),
  NODE_PREFIX_PATH: null,
  LAST_MODULES_PATH: null
}

export function getESLintInstance(filePath, config) {
  const fileDir = Path.dirname(filePath)
  const modulesDir = findCached(fileDir, 'node_modules')

  refreshModulesPath(modulesDir)
  return getESLintFromDirectory(modulesDir, config)
}

export function getESLintFromDirectory(modulesDir, config) {
  let ESLintDirectory = null

  if (config.useGlobalEslint) {
    const prefixPath = config.globalNodePath || getNodePrefixPath()
    if (process.platform === 'win32') {
      ESLintDirectory = Path.join(prefixPath, 'node_modules', 'eslint')
    } else {
      ESLintDirectory = Path.join(prefixPath, 'lib', 'node_modules', 'eslint')
    }
  } else {
    if (modulesDir === null) {
      throw new Error('Cannot find module `eslint`')
    }
    ESLintDirectory = Path.join(modulesDir, 'eslint')
  }
  try {
    return require(Path.join(ESLintDirectory, 'lib', 'cli.js'))
  } catch (e) {
    if (config.useGlobalEslint && e.code === 'MODULE_NOT_FOUND') {
      throw new Error('ESLint not found, Please install or make sure Atom is getting $PATH correctly')
    }
    return require(Cache.ESLINT_LOCAL_PATH)
  }
}

export function refreshModulesPath(modulesDir) {
  if (Cache.LAST_MODULES_PATH !== modulesDir) {
    Cache.LAST_MODULES_PATH = modulesDir
    process.env.NODE_PATH = modulesDir || ''
    require('module').Module._initPaths()
  }
}

export function getNodePrefixPath() {
  if (Cache.NODE_PREFIX_PATH === null) {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    try {
      Cache.NODE_PREFIX_PATH = ChildProcess.spawnSync(npmCommand, ['get', 'prefix']).output[1].toString().trim()
    } catch (e) {
      throw new Error('Unable to execute `npm get prefix`. Please make sure Atom is getting $PATH correctly')
    }
  }
  return Cache.NODE_PREFIX_PATH
}

export function getConfigPath(fileDir) {
  const configFile = findCached(fileDir, ['.eslintrc.js', '.eslintrc.yaml', '.eslintrc.yml', '.eslintrc.json', '.eslintrc'])
  if (configFile) {
    return configFile
  }

  const packagePath = findCached(fileDir, 'package.json')
  if (packagePath && Boolean(require(packagePath).eslintConfig)) {
    return packagePath
  }
  return null
}
