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
    return require(Path.join(ESLintDirectory, 'lib', 'cli.js'))
  } catch (e) {
    if (config.useGlobalEslint && e.code === 'MODULE_NOT_FOUND') {
      throw new Error(
        'ESLint not found, Please install or make sure Atom is getting $PATH correctly'
      )
    }
    // eslint-disable-next-line import/no-dynamic-require
    return require(Path.join(Cache.ESLINT_LOCAL_PATH, 'lib', 'cli.js'))
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
      '.eslintrc.js', '.eslintrc.yaml', '.eslintrc.yml', '.eslintrc.json', '.eslintrc'
    ])
  if (configFile) {
    return configFile
  }

  const packagePath = findCached(fileDir, 'package.json')
  // eslint-disable-next-line import/no-dynamic-require
  if (packagePath && Boolean(require(packagePath).eslintConfig)) {
    return packagePath
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

export function getArgv(type, config, rules, filePath, fileDir, givenConfigPath) {
  let configPath
  if (givenConfigPath === null) {
    configPath = config.eslintrcPath || null
  } else configPath = givenConfigPath

  const argv = [
    process.execPath,
    'a-b-c' // dummy value for eslint executable
  ]
  if (type === 'lint') {
    argv.push('--stdin')
  }
  argv.push('--format', Path.join(__dirname, 'reporter.js'))

  const ignoreFile = config.disableEslintIgnore ? null : findCached(fileDir, '.eslintignore')
  if (ignoreFile) {
    argv.push('--ignore-path', ignoreFile)
  }

  if (config.eslintRulesDir) {
    let rulesDir = resolveEnv(config.eslintRulesDir)
    if (!Path.isAbsolute(rulesDir)) {
      rulesDir = findCached(fileDir, rulesDir)
    }
    if (rulesDir) {
      argv.push('--rulesdir', rulesDir)
    }
  }
  if (configPath) {
    argv.push('--config', resolveEnv(configPath))
  }
  if (rules && Object.keys(rules).length > 0) {
    argv.push('--rule', JSON.stringify(rules))
  }
  if (config.disableEslintIgnore) {
    argv.push('--no-ignore')
  }
  if (type === 'lint') {
    argv.push('--stdin-filename', filePath)
  } else if (type === 'fix') {
    argv.push(filePath)
    argv.push('--fix')
  }

  return argv
}
