'use babel'

/* global emit */

import Path from 'path'
import { FindCache, findCached } from 'atom-linter'
import {
  cdToProjectRoot,
  findESLintDirectory,
  getConfigPath,
  getModulesDirAndRefresh
} from '../file-system'
import {
  getESLintInstance,
  didRulesChange,
  getRules,
  getCLIEngineOptions,
} from './helpers'
import { isLintDisabled } from '../eslint-config-inspector'

process.title = 'linter-eslint helper'

const rulesMetadata = new Map()
let shouldSendRules = false

function lintJob({ cliEngineOptions, contents, eslint, filePath }) {
  const cliEngine = new eslint.CLIEngine(cliEngineOptions)
  const report = cliEngine.executeOnText(contents, filePath)
  const rules = getRules(cliEngine)
  shouldSendRules = didRulesChange(rulesMetadata, rules)
  if (shouldSendRules) {
    // Rebuild rulesMetadata
    rulesMetadata.clear()
    rules.forEach((properties, rule) => rulesMetadata.set(rule, properties))
  }
  return report
}

function fixJob({ cliEngineOptions, contents, eslint, filePath }) {
  const report = lintJob({ cliEngineOptions, contents, eslint, filePath })

  eslint.CLIEngine.outputFixes(report)

  if (!report.results.length || !report.results[0].messages.length) {
    return 'Linter-ESLint: Fix complete.'
  }
  return 'Linter-ESLint: Fix attempt complete, but linting errors remain.'
}

module.exports = async () => {
  process.on('message', ({
    contents,
    emitKey,
    filePath,
    projectPath,
    rules,
    type,
    config: {
      advancedLocalNodeModules,
      disableFSCache,
      disableEslintIgnore,
      disableWhenNoEslintConfig,
      globalNodePath,
      eslintrcPath,
      eslintRulesDirs,
      useGlobalEslint
    },
  }) => {
    // We catch all worker errors so that we can create a separate error emitter
    // for each emitKey, rather than adding multiple listeners for `task:error`
    try {
      if (disableFSCache) {
        FindCache.clear()
      }

      const getEslintDir = modulesDir => findESLintDirectory({
        modulesDir,
        projectPath,
        useGlobalEslint,
        globalNodePath,
        advancedLocalNodeModules
      })

      const fileDir = Path.dirname(filePath)
      const modulesDirectory = getModulesDirAndRefresh(fileDir)
      const { path: eslintDir } = getEslintDir(modulesDirectory)

      const eslint = getESLintInstance(eslintDir)

      if (isLintDisabled({ fileDir, disableWhenNoEslintConfig })) {
        emit(emitKey, { messages: [] })
        return
      }

      const configPath = getConfigPath(fileDir)

      // ESLint does some of it's own searching for project files. Make
      //  sure it does that search from the correct working directory
      cdToProjectRoot({ disableEslintIgnore, projectPath, fileDir })

      const cliEngineOptions = getCLIEngineOptions({
        type,
        rules,
        fileDir,
        configPath,
        disableEslintIgnore,
        eslintRulesDirs,
        eslintrcPath
      })

      let response
      if (type === 'lint') {
        const report = lintJob({ cliEngineOptions, contents, eslint, filePath })
        response = {
          messages: report.results.length ? report.results[0].messages : []
        }
        if (shouldSendRules) {
        // You can't emit Maps, convert to Array of Arrays to send back.
          response.updatedRules = Array.from(rulesMetadata)
        }
      } else if (type === 'fix') {
        response = fixJob({ cliEngineOptions, contents, eslint, filePath })
      } else if (type === 'debug') {
        const modulesDir = Path.dirname(findCached(fileDir, 'node_modules/eslint') || '')
        response = getEslintDir(modulesDir)
      }
      emit(emitKey, response)
    } catch (workerErr) {
      emit(`workerError:${emitKey}`, { msg: workerErr.message, stack: workerErr.stack })
    }
  })
}
