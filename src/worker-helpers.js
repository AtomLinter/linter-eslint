'use babel'

import Path from 'path'
import fs from 'fs'
import ChildProcess from 'child_process'
import resolveEnv from 'resolve-env'
import { findCached } from 'atom-linter'
import getPath from 'consistent-path'

const Cache = {
  ESLINT_LOCAL_PATH: Path.normalize(Path.join(__dirname, '..', 'node_modules', 'eslint')),
  NODE_PREFIX_PATH: null,
  LAST_MODULES_PATH: null
}

export function getNodePrefixPath() {
  if (Cache.NODE_PREFIX_PATH === null) {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    try {
      Cache.NODE_PREFIX_PATH =
        ChildProcess.spawnSync(npmCommand, ['get', 'prefix'], {
          env: Object.assign(Object.assign({}, process.env), { PATH: getPath() })
        }).output[1].toString().trim()
    } catch (e) {
      throw new Error(
        'Unable to execute `npm get prefix`. Please make sure Atom is getting $PATH correctly'
      )
    }
  }
  return Cache.NODE_PREFIX_PATH
}

export function findESLintDirectory(modulesDir, config, projectPath) {
  let eslintDir = null
  let locationType = null
  if (config.useGlobalEslint) {
    locationType = 'global'
    const prefixPath = config.globalNodePath || getNodePrefixPath()
    if (process.platform === 'win32') {
      eslintDir = Path.join(prefixPath, 'node_modules', 'eslint')
    } else {
      eslintDir = Path.join(prefixPath, 'lib', 'node_modules', 'eslint')
    }
  } else if (!config.advancedLocalNodeModules) {
    locationType = 'local project'
    eslintDir = Path.join(modulesDir || '', 'eslint')
  } else if (Path.isAbsolute(config.advancedLocalNodeModules)) {
    locationType = 'advanced specified'
    eslintDir = Path.join(config.advancedLocalNodeModules || '', 'eslint')
  } else {
    locationType = 'advanced specified'
    eslintDir = Path.join(projectPath, config.advancedLocalNodeModules, 'eslint')
  }
  try {
    if (fs.statSync(eslintDir).isDirectory()) {
      return {
        path: eslintDir,
        type: locationType,
      }
    }
  } catch (e) {
    if (config.useGlobalEslint && e.code === 'ENOENT') {
      throw new Error(
          'ESLint not found, Please install or make sure Atom is getting $PATH correctly'
        )
    }
  }
  return {
    path: Cache.ESLINT_LOCAL_PATH,
    type: 'bundled fallback',
  }
}

export function getESLintFromDirectory(modulesDir, config, projectPath) {
  const { path: ESLintDirectory } = findESLintDirectory(modulesDir, config, projectPath)
  try {
    // eslint-disable-next-line import/no-dynamic-require
    return require(ESLintDirectory)
  } catch (e) {
    if (config.useGlobalEslint && e.code === 'MODULE_NOT_FOUND') {
      throw new Error(
        'ESLint not found, Please install or make sure Atom is getting $PATH correctly'
      )
    }
    // eslint-disable-next-line import/no-dynamic-require
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

export function getESLintInstance(fileDir, config, projectPath) {
  const modulesDir = Path.dirname(findCached(fileDir, 'node_modules/eslint') || '')
  refreshModulesPath(modulesDir)
  return getESLintFromDirectory(modulesDir, config, projectPath || '')
}

export function getConfigPath(fileDir) {
  const configFile =
    findCached(fileDir, [
      '.eslintrc.js', '.eslintrc.yaml', '.eslintrc.yml', '.eslintrc.json', '.eslintrc', 'package.json'
    ])
  if (configFile) {
    if (Path.basename(configFile) === 'package.json') {
      // eslint-disable-next-line import/no-dynamic-require
      if (require(configFile).eslintConfig) {
        return configFile
      }
      // If we are here, we found a package.json without an eslint config
      // in a dir without any other eslint config files
      // (because 'package.json' is last in the call to findCached)
      // So, keep looking from the parent directory
      return getConfigPath(Path.resolve(Path.dirname(configFile), '..'))
    }
    return configFile
  }
  return null
}

export function getRelativePath(fileDir, filePath, config) {
  const ignoreFile = config.disableEslintIgnore ? null : findCached(fileDir, '.eslintignore')

  if (ignoreFile) {
    const ignoreDir = Path.dirname(ignoreFile)
    process.chdir(ignoreDir)
    return Path.relative(ignoreDir, filePath)
  }
  process.chdir(fileDir)
  return Path.basename(filePath)
}

export function getCLIEngineOptions(type, config, rules, filePath, fileDir, givenConfigPath) {
  const cliEngineConfig = {
    rules,
    ignore: !config.disableEslintIgnore,
    fix: type === 'fix'
  }

  const ignoreFile = config.disableEslintIgnore ? null : findCached(fileDir, '.eslintignore')
  if (ignoreFile) {
    cliEngineConfig.ignorePath = ignoreFile
  }

  if (config.eslintRulesDir) {
    let rulesDir = resolveEnv(config.eslintRulesDir)
    if (!Path.isAbsolute(rulesDir)) {
      rulesDir = findCached(fileDir, rulesDir)
    }
    if (rulesDir) {
      cliEngineConfig.rulePaths = [rulesDir]
    }
  }

  if (givenConfigPath === null && config.eslintrcPath) {
    // If we didn't find a configuration use the fallback from the settings
    cliEngineConfig.configFile = resolveEnv(config.eslintrcPath)
  }

  return cliEngineConfig
}
