'use babel'

/* global emit */

import Path from 'path'
import { FindCache, findCached } from 'atom-linter'
import * as Helpers from './worker-helpers'
import isConfigAtHomeRoot from './is-config-at-home-root'

import store from './store/worker'
import { diffRules } from './store/actions/rules'

process.title = 'linter-eslint helper'

function lintJob({ cliEngineOptions, contents, eslint, filePath }) {
  const cliEngine = new eslint.CLIEngine(cliEngineOptions)
  const report = cliEngine.executeOnText(contents, filePath)
  const rules = Helpers.getRules(cliEngine)
  return { report, rules }
}

function fixJob({ cliEngineOptions, contents, eslint, filePath }) {
  const { report } = lintJob({ cliEngineOptions, contents, eslint, filePath })
  eslint.CLIEngine.outputFixes(report)

  if (!report.results.length || !report.results[0].messages.length) {
    return 'Linter-ESLint: Fix complete.'
  }
  return 'Linter-ESLint: Fix attempt complete, but linting errors remain.'
}

module.exports = async () => {
  process.on('message', ({
    contents, type, config, filePath, projectPath, rules, emitKey
  }) => {
    // We catch all worker errors so that we can create a separate error emitter
    // for each emitKey, rather than adding multiple listeners for `task:error`

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
      const jobConfig = { cliEngineOptions, contents, eslint, filePath }
      if (type === 'lint') {
        const { report, rules: newRules } =
          lintJob(jobConfig)
        response = {
          messages: report.results.length ? report.results[0].messages : [],
          rulesDiff: store.dispatch(diffRules(newRules))
        }
      } else if (type === 'fix') {
        response = fixJob(jobConfig)
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
