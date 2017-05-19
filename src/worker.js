'use babel'

/* global emit */

import Path from 'path'
import { FindCache, findCached } from 'atom-linter'
import * as Helpers from './worker-helpers'
import isConfigAtHomeRoot from './is-config-at-home-root'

process.title = 'linter-eslint helper'

function lintJob({ cliEngineOptions, contents, eslint, filePath }) {
  const cliEngine = new eslint.CLIEngine(cliEngineOptions)
  return cliEngine.executeOnText(contents, filePath)
}

function fixJob({ cliEngineOptions, contents, eslint, filePath }) {
  const report = lintJob({ cliEngineOptions, contents, eslint, filePath })

  eslint.CLIEngine.outputFixes(report)

  if (!report.results.length || !report.results[0].messages.length) {
    return 'Linter-ESLint: Fix complete.'
  }
  return 'Linter-ESLint: Fix attempt complete, but linting errors remain.'
}

module.exports = async function () {
  process.on('message', (jobConfig) => {
    const { contents, type, config, filePath, projectPath, rules, emitKey } = jobConfig
    if (config.disableFSCache) {
      FindCache.clear()
    }

    const fileDir = Path.dirname(filePath)
    const eslint = Helpers.getESLintInstance(fileDir, config, projectPath)
    const configPath = Helpers.getConfigPath(fileDir)
    const noProjectConfig = (configPath === null || isConfigAtHomeRoot(configPath))
    if (noProjectConfig && config.disableWhenNoEslintConfig) {
      emit(emitKey, [])
      return
    }

    const relativeFilePath = Helpers.getRelativePath(fileDir, filePath, config)

    const cliEngineOptions = Helpers.getCLIEngineOptions(
      type, config, rules, relativeFilePath, fileDir, configPath
    )

    let response
    if (type === 'lint') {
      const report = lintJob({ cliEngineOptions, contents, eslint, filePath })
      response = report.results.length ? report.results[0].messages : []
    } else if (type === 'fix') {
      response = fixJob({ cliEngineOptions, contents, eslint, filePath })
    } else if (type === 'debug') {
      const modulesDir = Path.dirname(findCached(fileDir, 'node_modules/eslint') || '')
      response = Helpers.findESLintDirectory(modulesDir, config)
    }
    emit(emitKey, response)
  })
}
