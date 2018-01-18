'use babel'

/* global emit */

import Path from 'path'
import { FindCache, findCached } from 'atom-linter'
import * as Helpers from './worker-helpers'
import isConfigAtHomeRoot from './is-config-at-home-root'

process.title = 'linter-eslint helper'

const rulesMetadata = new Map()
let shouldSendRules = false

function lintJob({ cliEngineOptions, contents, eslint, filePath }) {
  const cliEngine = new eslint.CLIEngine(cliEngineOptions)
  const report = cliEngine.executeOnText(contents, filePath)
  const rules = Helpers.getRules(cliEngine)
  shouldSendRules = Helpers.didRulesChange(rulesMetadata, rules)
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
  process.on('message', (jobConfig) => {
    // We catch all worker errors so that we can create a separate error emitter
    // for each emitKey, rather than adding multiple listeners for `task:error`
    const {
      contents, type, config, filePath, projectPath, rules, emitKey
    } = jobConfig
    try {
      if (config.disableFSCache) {
        FindCache.clear()
      }

      const fileDir = Path.dirname(filePath)
      const eslint = Helpers.getESLintInstance(fileDir, config, projectPath)
      const configPath = Helpers.getConfigPath(fileDir)
      const noProjectConfig = (configPath === null || isConfigAtHomeRoot(configPath))
      if (noProjectConfig && config.disableWhenNoEslintConfig) {
        emit(emitKey, { messages: [] })
        return
      }

      const relativeFilePath = Helpers.getRelativePath(fileDir, filePath, config, projectPath)

      const cliEngineOptions = Helpers
        .getCLIEngineOptions(type, config, rules, relativeFilePath, fileDir, configPath)

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
        response = Helpers.findESLintDirectory(modulesDir, config, projectPath)
      }
      emit(emitKey, response)
    } catch (workerErr) {
      emit(`workerError:${emitKey}`, { msg: workerErr.message, stack: workerErr.stack })
    }
  })
}
