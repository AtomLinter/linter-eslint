'use babel'

import Path from 'path'
import FS from 'fs'
import {find} from 'atom-linter'

export function getEslint(params) {
  const modulesPath = getModulesDirectory(params.fileDir)
  const eslintDirectory = getEslintDirectory(params, modulesPath)
  if (eslintDirectory !== lastEslintDirectory) {
    lastEslintDirectory = eslintDirectory
    eslint = getEslintFromDirectory(eslintDirectory)
  }
  if (lastModulesPath !== modulesPath) {
    lastModulesPath = modulesPath
    if (modulesPath) {
      process.env.NODE_PATH = modulesPath
    } else process.env.NODE_PATH = ''
    require('module').Module._initPaths()
  }
  return {eslint, eslintDirectory}
}

export function getESLint(filePath, config) {
  const fileDir = Path.dirname(filePath)
}

export function getModulesDirectory(fileDir) {
  return find(fileDir, 'node_modules')
}

export function getIgnoresFile(fileDir) {
  return Path.dirname(find(fileDir, '.eslintignore'))
}

export function getEslintFromDirectory(path) {
  try {
    return require(Path.join(path, 'lib', 'cli.js'))
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      throw new Error('ESLint not found, Please install or make sure Atom is getting $PATH correctly')
    } else throw e
  }
}

let nodePrefixPath = null

export function getNodePrefixPath() {
  if (nodePrefixPath === null) {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    try {
      nodePrefixPath = ChildProcess.spawnSync(npmCommand, ['get', 'prefix']).output[1].toString().trim()
    } catch (e) {
      throw new Error('Unable to execute `npm get prefix`. Please make sure Atom is getting $PATH correctly')
    }
  }
  return nodePrefixPath
}

let bundledEslintDirectory = null

export function getBundledEslintDirectory() {
  if (bundledEslintDirectory === null) {
    bundledEslintDirectory = Path.normalize(Path.join(__dirname, '..', 'node_modules', 'eslint'))
  }
  return bundledEslintDirectory
}

export function getEslintDirectory(params, modulesPath = null) {
  if (params.global) {
    const prefixPath = getNodePrefixPath()
    if (process.platform === 'win32') {
      return Path.join(params.nodePath || prefixPath, 'node_modules', 'eslint')
    }
    return Path.join(params.nodePath || prefixPath, 'lib', 'node_modules', 'eslint')
  }
  const eslintPath = Path.join(modulesPath || getModulesDirectory(params.fileDir), 'eslint')
  try {
    FS.accessSync(eslintPath, FS.R_OK)
    return eslintPath
  } catch (_) {
    return getBundledEslintDirectory()
  }
}

export function getEslintConfig(params) {
  const configFile = find(params.fileDir, ['.eslintrc.js', '.eslintrc.yaml', '.eslintrc.yml', '.eslintrc.json', '.eslintrc']) || null
  if (configFile) {
    return configFile
  }

  const packagePath = find(params.fileDir, 'package.json')
  if (packagePath && Boolean(require(packagePath).eslintConfig)) {
    return packagePath
  }

  if (params.canDisable) {
    return null
  }

  if (params.configFile) {
    return params.configFile
  }
}
