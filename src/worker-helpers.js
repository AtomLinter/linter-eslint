/* global emit */

import Path from 'path'
import Util from 'util'
import fs from 'fs-plus'
import ChildProcess from 'child_process'
import resolveEnv from 'resolve-env'
import { findCached } from 'atom-linter'
import getPath from 'consistent-path'

const Cache = {
  ESLINT_LOCAL_PATH: Path.normalize(Path.join(__dirname, '..', 'node_modules', 'eslint')),
  NODE_PREFIX_PATH: null,
  LAST_MODULES_PATH: null
}

class IncompatibleESLintError extends Error {
  constructor(version) {
    // eslint-disable-next-line max-len
    super(`The version of ESLint used in this project is ${version}, which is incompatible with this package. The \`linter-eslint-node\` Atom package provides support for ESLint versions 8 and higher.\n\nYou can disable this notice in the linter-eslint package settings under **Uncommon → Notify when incompatible ESLint is detected**.`)
    this.name = 'IncompatibleESLintError'
  }
}

/**
 * Takes a path and translates `~` to the user's home directory, and replaces
 * all environment variables with their value.
 * @param  {string} path The path to remove "strangeness" from
 * @return {string}      The cleaned path
 */
const cleanPath = (path) => (path ? resolveEnv(fs.normalize(path)) : '')

/**
 * @returns {string}
 */
export function getNodePrefixPath() {
  if (Cache.NODE_PREFIX_PATH === null) {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    try {
      Cache.NODE_PREFIX_PATH = ChildProcess.spawnSync(npmCommand, ['get', 'prefix'], {
        env: { ...process.env, PATH: getPath() }
      }).output[1].toString().trim()
    } catch (e) {
      const errMsg = 'Unable to execute `npm get prefix`. Please make sure '
        + 'Atom is getting $PATH correctly.'
      throw new Error(errMsg)
    }
  }
  return Cache.NODE_PREFIX_PATH
}

/**
 * @param {string} dirPath
 * @returns {boolean}
 */
function isDirectory(dirPath) {
  let isDir
  try {
    isDir = fs.statSync(dirPath).isDirectory()
  } catch (e) {
    isDir = false
  }
  return isDir
}

let fallbackForGlobalErrorThrown = false

/**
 * @param {string} modulesDir
 * @param {object} config
 * @param {string} projectPath
 * @param {boolean} fallbackForGlobal
 * @returns {{ path: string, type: 'local project' | 'global' | 'advanced specified' | 'bundled fallback' }}
 */
export function findESLintDirectory(modulesDir, config, projectPath, fallbackForGlobal = false) {
  let eslintDir = null
  let locationType = null
  if (config.global.useGlobalEslint && !fallbackForGlobal) {
    locationType = 'global'
    const configGlobal = cleanPath(config.global.globalNodePath)
    const prefixPath = configGlobal || getNodePrefixPath()
    // NPM on Windows and Yarn on all platforms
    eslintDir = Path.join(prefixPath, 'node_modules', 'eslint')
    if (!isDirectory(eslintDir)) {
      // NPM on platforms other than Windows
      eslintDir = Path.join(prefixPath, 'lib', 'node_modules', 'eslint')
    }
  } else if (!config.advanced.localNodeModules) {
    locationType = 'local project'
    eslintDir = Path.join(modulesDir || '', 'eslint')
  } else if (Path.isAbsolute(cleanPath(config.advanced.localNodeModules))) {
    locationType = 'advanced specified'
    eslintDir = Path.join(cleanPath(config.advanced.localNodeModules), 'eslint')
  } else {
    locationType = 'advanced specified'
    eslintDir = Path.join(projectPath || '', cleanPath(config.advanced.localNodeModules), 'eslint')
  }

  if (isDirectory(eslintDir)) {
    return {
      path: eslintDir,
      type: locationType,
    }
  }

  if (config.global.useGlobalEslint && !fallbackForGlobal) {
    if (!fallbackForGlobalErrorThrown) {
      // Throw the error only once to prevent performance issues
      fallbackForGlobalErrorThrown = true
      console.error(`Global ESLint is not found, falling back to other Eslint installations...
        Please ensure the global Node path is set correctly.
        If you wanted to use a local installation of Eslint, disable Global Eslint option in the linter-eslint config.`)
    }
    return findESLintDirectory(modulesDir, config, projectPath, true)
  }

  return {
    path: Cache.ESLINT_LOCAL_PATH,
    type: 'bundled fallback',
  }
}

// Given an ESLint module path, checks its version and throws if the version is
// too new for this package to support.
function checkForIncompatibleESLint(directory) {
  let packageMeta
  try {
    // eslint-disable-next-line import/no-dynamic-require
    packageMeta = require(Path.join(directory, 'package.json'))
    if (!packageMeta || !packageMeta.version) {
      return
    }
  } catch (_) {
    return
  }
  // We don't need sophisticated parsing logic here; we just need to look at
  // the major version.
  const m = packageMeta.version.match(/^([\d]+)\./)
  if (m && Number(m[1]) > 7) {
    throw new IncompatibleESLintError(packageMeta.version)
  }
}

/**
 * @param {string} modulesDir
 * @param {object} config
 * @param {string} projectPath
 * @returns {import("eslint")}
 */
export function getESLintFromDirectory(modulesDir, config, projectPath) {
  const { path: ESLintDirectory } = findESLintDirectory(modulesDir, config, projectPath)
  let eslint
  try {
    // eslint-disable-next-line import/no-dynamic-require
    eslint = require(ESLintDirectory)
    if (!('CLIEngine' in eslint)) {
      checkForIncompatibleESLint(ESLintDirectory)
    }
    return eslint
  } catch (e) {
    // If this is the result of an incompatible ESLint, an error will be
    // thrown; otherwise we should proceed with the local-path fallback.
    checkForIncompatibleESLint(ESLintDirectory)

    if (config.global.useGlobalEslint && e.code === 'MODULE_NOT_FOUND') {
      throw new Error('ESLint not found, try restarting Atom to clear caches.')
    }
    // eslint-disable-next-line import/no-dynamic-require
    return require(Cache.ESLINT_LOCAL_PATH)
  }
}

/**
 * @param {string} modulesDir
 */
export function refreshModulesPath(modulesDir) {
  if (Cache.LAST_MODULES_PATH !== modulesDir) {
    Cache.LAST_MODULES_PATH = modulesDir
    process.env.NODE_PATH = modulesDir || ''
    // eslint-disable-next-line no-underscore-dangle
    require('module').Module._initPaths()
  }
}

/**
 * @param {string} fileDir
 * @param {object} config
 * @param {string} projectPath
 * @returns {import("eslint")}
 */
export function getESLintInstance(fileDir, config, projectPath) {
  const modulesDir = Path.dirname(findCached(fileDir, 'node_modules/eslint') || '')
  refreshModulesPath(modulesDir)
  return getESLintFromDirectory(modulesDir, config, projectPath)
}

/**
 * console.log
 * @param  {any} args
 * @return {void}
 */
export function log(...args) {
  const obj = args.length === 1 ? args[0] : args
  let str
  try {
    str = JSON.stringify(obj)
  } catch (e) {
    str = Util.inspect(obj)
  }

  emit('log', str)
}

/**
 * @param {import("eslint")} eslint
 * @param {string} filePath
 */
export function getConfigForFile(eslint, filePath) {
  const cli = new eslint.CLIEngine()
  try {
    return cli.getConfigForFile(filePath)
  } catch (e) {
    // No configuration was found
    return null
  }
}

/**
 * @param {string} fileDir
 * @param {string} filePath
 * @param {object} config
 * @param {string} projectPath
 * @returns {string}
 */
export function getRelativePath(fileDir, filePath, config, projectPath) {
  const ignoreFile = config.advanced.disableEslintIgnore ? null : findCached(fileDir, '.eslintignore')

  // If we can find an .eslintignore file, we can set cwd there
  // (because they are expected to be at the project root)
  if (ignoreFile) {
    const ignoreDir = Path.dirname(ignoreFile)
    process.chdir(ignoreDir)
    return Path.relative(ignoreDir, filePath)
  }
  // Otherwise, we'll set the cwd to the atom project root as long as that exists
  if (projectPath) {
    process.chdir(projectPath)
    return Path.relative(projectPath, filePath)
  }
  // If all else fails, use the file location itself
  process.chdir(fileDir)
  return Path.basename(filePath)
}

/**
 * @param {string} type
 * @param {string[]} rules
 * @param {object} config
 * @param {string} filePath
 * @param {object} fileConfig
 */
export function getCLIEngineOptions(type, config, rules, filePath, fileConfig) {
  const cliEngineConfig = {
    rules,
    ignore: !config.advanced.disableEslintIgnore,
    fix: type === 'fix'
  }

  cliEngineConfig.rulePaths = config.advanced.eslintRulesDirs.map((path) => {
    const rulesDir = cleanPath(path)
    if (!Path.isAbsolute(rulesDir)) {
      return findCached(Path.dirname(filePath), rulesDir)
    }
    return rulesDir
  }).filter((path) => path)

  if (fileConfig === null && config.global.eslintrcPath) {
    // If we didn't find a configuration use the fallback from the settings
    cliEngineConfig.configFile = cleanPath(config.global.eslintrcPath)
  }

  return cliEngineConfig
}

/**
 * Gets the list of rules used for a lint job
 * @param  {import("eslint").CLIEngine} cliEngine The CLIEngine instance used for the lint job
 * @return {Map}              A Map of the rules used, rule names as keys, rule
 *                            properties as the contents.
 */
export function getRules(cliEngine) {
  // Pull the list of rules used directly from the CLIEngine
  if (typeof cliEngine.getRules === 'function') {
    return cliEngine.getRules()
  }

  // Attempt to use the internal (undocumented) `linter` instance attached to
  // the CLIEngine to get the loaded rules (including plugin rules).
  // Added in ESLint v4
  if (Object.prototype.hasOwnProperty.call(cliEngine, 'linter')) {
    return cliEngine.linter.getRules()
  }

  // Older versions of ESLint don't (easily) support getting a list of rules
  return new Map()
}

/**
 * Given an exiting rule list and a new rule list, determines whether there
 * have been changes.
 * NOTE: This only accounts for presence of the rules, changes to their metadata
 * are not taken into account.
 * @param  {Map} newRules     A Map of the new rules
 * @param  {Map} currentRules A Map of the current rules
 * @return {boolean}             Whether or not there were changes
 */
export function didRulesChange(currentRules, newRules) {
  return !(currentRules.size === newRules.size
    && Array.from(currentRules.keys()).every((ruleId) => newRules.has(ruleId)))
}
