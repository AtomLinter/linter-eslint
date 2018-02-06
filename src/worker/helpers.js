'use babel'

import Path from 'path'
import { findCached } from 'atom-linter'
import { cleanPath, getIgnoreFile, getNodePrefixPath } from '../file-system'
import { isDirectory } from '../validate/fs'

const Cache = {
  ESLINT_LOCAL_PATH: Path.normalize(Path.join(__dirname, '..', '..', 'node_modules', 'eslint')),
  LAST_MODULES_PATH: null
}

export function findESLintDirectory({
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
    eslintDir = Path.join(prefixPath, 'node_modules', 'eslint')
    if (!isDirectory(eslintDir)) {
      // NPM on platforms other than Windows
      eslintDir = Path.join(prefixPath, 'lib', 'node_modules', 'eslint')
    }
  } else if (!advancedLocalNodeModules) {
    locationType = 'local project'
    eslintDir = Path.join(modulesDir || '', 'eslint')
  } else if (Path.isAbsolute(cleanPath(advancedLocalNodeModules))) {
    locationType = 'advanced specified'
    eslintDir = Path.join(cleanPath(advancedLocalNodeModules), 'eslint')
  } else {
    locationType = 'advanced specified'
    eslintDir = Path.join(projectPath || '', cleanPath(advancedLocalNodeModules), 'eslint')
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
    path: Cache.ESLINT_LOCAL_PATH,
    type: 'bundled fallback',
  }
}

export function refreshModulesPath(modulesDir) {
  if (Cache.LAST_MODULES_PATH !== modulesDir) {
    Cache.LAST_MODULES_PATH = modulesDir
    process.env.NODE_PATH = modulesDir || ''
    // eslint-disable-next-line no-underscore-dangle
    require('module').Module._initPaths()
  }
}

export const getModulesDir = fileDir =>
  Path.dirname(findCached(fileDir, 'node_modules/eslint') || '')

export const getModulesDirAndRefresh = (fileDir) => {
  const modulesDir = getModulesDir(fileDir)
  refreshModulesPath(modulesDir)
  return modulesDir
}


export const getESLintInstance = (eslintDir) => {
  try {
    // eslint-disable-next-line import/no-dynamic-require
    return require(eslintDir)
  } catch (e) {
    throw new Error('ESLint not found, try restarting Atom to clear caches.')
  }
}

export function getCLIEngineOptions({
  type,
  rules,
  fileDir,
  configPath,
  disableEslintIgnore,
  eslintRulesDirs,
  eslintrcPath
}) {
  const cliEngineConfig = {
    rules,
    ignore: !disableEslintIgnore,
    fix: type === 'fix'
  }

  const ignoreFile = getIgnoreFile({ disableEslintIgnore, fileDir })
  if (ignoreFile) {
    cliEngineConfig.ignorePath = ignoreFile
  }

  cliEngineConfig.rulePaths = eslintRulesDirs.map((path) => {
    const rulesDir = cleanPath(path)
    if (!Path.isAbsolute(rulesDir)) {
      return findCached(fileDir, rulesDir)
    }
    return rulesDir
  }).filter(path => path)

  if (configPath === null && eslintrcPath) {
    // If we didn't find a configuration use the fallback from the settings
    cliEngineConfig.configFile = cleanPath(eslintrcPath)
  }

  return cliEngineConfig
}

/**
 * Gets the list of rules used for a lint job
 * @param  {Object} cliEngine The CLIEngine instance used for the lint job
 * @return {Map}              A Map of the rules used, rule names as keys, rule
 *                            properties as the contents.
 */
export function getRules(cliEngine) {
  // Pull the list of rules used directly from the CLIEngine
  // Added in https://github.com/eslint/eslint/pull/9782
  if (Object.prototype.hasOwnProperty.call(cliEngine, 'getRules')) {
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
  return !(currentRules.size === newRules.size &&
    Array.from(currentRules.keys()).every(ruleId => newRules.has(ruleId)))
}
