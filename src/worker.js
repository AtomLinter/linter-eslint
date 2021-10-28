/* global emit */

import * as Path from 'path'
import { FindCache, findCached } from 'atom-linter'
import * as Helpers from './worker-helpers'

process.title = 'linter-eslint helper'

const rulesMetadata = new Map()
let shouldSendRules = false

/**
 * The return of {getCLIEngineOptions} function
 * @typedef {object} CliEngineOptions
 * @property {string[]} rules
 * @property {boolean} ignore
 * @property {boolean} fix
 * @property {string[]} rulePaths
 * @property {string | undefined} configFile
 */

/**
 * @param {import("eslint")} eslint
 * @param {CliEngineOptions} cliEngineOptions
 * @param {string} contents
 * @param {string} filePath
 */
function lintJobCLIEngine(eslint, cliEngineOptions, contents, filePath) {
  const cliEngine = new eslint.CLIEngine(cliEngineOptions)
  const report = cliEngine.executeOnText(contents, filePath)
  const rules = Helpers.getCLIEngineRules(cliEngine)

  shouldSendRules = Helpers.didRulesChange(rulesMetadata, rules)
  if (shouldSendRules) {
    // Rebuild rulesMetadata
    rulesMetadata.clear()
    rules.forEach((properties, rule) => rulesMetadata.set(rule, properties))
  }
  return report
}

/**
 * @param {import("eslint")} eslint
 * @param {CliEngineOptions} cliEngineOptions
 * @param {string} contents
 * @param {string} filePath
 */
function fixJobCLIEngine(eslint, cliEngineOptions, contents, filePath) {
  const report = lintJobCLIEngine(eslint, cliEngineOptions, contents, filePath)

  eslint.CLIEngine.outputFixes(report)

  if (!report.results.length || !report.results[0].messages.length) {
    return 'Linter-ESLint: Fix complete.'
  }
  return 'Linter-ESLint: Fix attempt complete, but linting errors remain.'
}

/**
 * @param {string} type
 * @param {import("eslint")} eslint
 * @param {CliEngineOptions} cliEngineOptions
 * @param {string} contents
 * @param {string} filePath
 */
function executeCLIEngine(type, eslint, cliEngineOptions, contents, filePath) {
  if (type === 'lint') {
    const report = lintJobCLIEngine(eslint, cliEngineOptions, contents, filePath)
    return {
      messages: report.results.length ? report.results[0].messages : [],
      updatedRules: shouldSendRules ? Array.from(rulesMetadata) : undefined
    }
  }

  if (type === 'fix') {
    return fixJobCLIEngine(eslint, cliEngineOptions, contents, filePath)
  }

  return undefined
}

/**
* The return of {getESLintOptions} function
* @typedef {object} ESLintOptions
* @property {object} overrideConfig
* @property {string[]} overrideConfig.rules
* @property {boolean} ignore
* @property {boolean} fix
* @property {string[]} rulePaths
* @property {string | undefined} overrideConfigFile
*/

/**
 * @param {import("eslint")} eslint
 * @param {ESLintOptions} eslintOptions
 * @param {string} contents
 * @param {string} filePath
 */
async function lintJobESLint(eslint, eslintOptions, contents, filePath) {
  const linter = new eslint.ESLint(eslintOptions)
  const report = await linter.lintText(contents, { filePath })
  const rules = await Helpers.getESLintRules(linter, { filePath })

  shouldSendRules = Helpers.didRulesChange(rulesMetadata, rules)
  if (shouldSendRules) {
    // Rebuild rulesMetadata
    rulesMetadata.clear()
    rules.forEach((properties, rule) => rulesMetadata.set(rule, properties))
  }
  return report
}

/**
 * @param {import("eslint")} eslint
 * @param {ESLintOptions} eslintOptions
 * @param {string} contents
 * @param {string} filePath
 */
async function fixJobESLint(eslint, eslintOptions, contents, filePath) {
  const report = await lintJobESLint(eslint, eslintOptions, contents, filePath)

  eslint.ESLint.outputFixes(report)

  if (!report.length || !report[0].messages.length) {
    return 'Linter-ESLint: Fix complete.'
  }
  return 'Linter-ESLint: Fix attempt complete, but linting errors remain.'
}

/**
 * @param {string} type
 * @param {import("eslint")} eslint
 * @param {ESLintOptions} eslintOptions
 * @param {string} contents
 * @param {string} filePath
 */
async function executeESLint(type, eslint, eslintOptions, contents, filePath) {
  if (type === 'lint') {
    const report = await lintJobESLint(eslint, eslintOptions, contents, filePath)
    return {
      messages: report.length ? report[0].messages : [],
      updatedRules: shouldSendRules ? Array.from(rulesMetadata) : undefined
    }
  }

  if (type === 'fix') {
    return fixJobESLint(eslint, eslintOptions, contents, filePath)
  }

  return undefined
}

module.exports = async () => {
  process.on('message', async (jobConfig) => {
    // We catch all worker errors so that we can create a separate error emitter
    // for each emitKey, rather than adding multiple listeners for `task:error`
    const {
      contents, type, config, filePath, projectPath, rules, emitKey
    } = jobConfig
    try {
      if (config.advanced.disableFSCache) {
        FindCache.clear()
      }

      const fileDir = Path.dirname(filePath)
      const eslint = Helpers.getESLintInstance(fileDir, config, projectPath)

      const fileConfig = await Helpers.getConfigForFile(eslint, filePath)
      if (fileConfig === null && config.disabling.disableWhenNoEslintConfig) {
        emit(emitKey, { messages: [] })
        return
      }

      const relativeFilePath = Helpers.getRelativePath(fileDir, filePath, config, projectPath)

      let response
      if (type === 'debug') {
        const modulesDir = Path.dirname(findCached(fileDir, 'node_modules/eslint') || '')
        response = Helpers.findESLintDirectory(modulesDir, config, projectPath)
      } else

      if (eslint.ESLint) {
        const eslintOptions = Helpers.getESLintOptions(type, config, rules, relativeFilePath, fileConfig)
        response = await executeESLint(type, eslint, eslintOptions, contents, filePath)
      } else

      if (eslint.CLIEngine) {
        const cliEngineOptions = Helpers.getCLIEngineOptions(type, config, rules, relativeFilePath, fileConfig)
        response = executeCLIEngine(type, eslint, cliEngineOptions, contents, filePath)
      }

      emit(emitKey, response)
    } catch (workerErr) {
      emit(`workerError:${emitKey}`, { msg: workerErr.message, stack: workerErr.stack })
    }
  })
}
