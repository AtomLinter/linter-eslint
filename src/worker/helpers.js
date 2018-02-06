'use babel'

import { isAbsolute as isAbsolutePath } from 'path'
import { findCached } from 'atom-linter'
import { cleanPath, getIgnoreFile } from '../file-system'


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
    if (!isAbsolutePath(rulesDir)) {
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
