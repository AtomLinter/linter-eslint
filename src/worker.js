'use babel'

/* global emit */

import Path from 'path'
import { FindCache, findCached } from 'atom-linter'
import * as Helpers from './worker-helpers'
import isConfigAtHomeRoot from './is-config-at-home-root'

process.title = 'linter-eslint helper'

const fixableRules = new Set()
let sendRules = false

function updateFixableRules(linter) {
  const currentRules = new Set()
  linter.getRules().forEach((props, rule) => {
    if (Object.prototype.hasOwnProperty.call(props.meta, 'fixable')) {
      currentRules.add(rule)
    }
  })

  sendRules = false

  const newRules = new Set(currentRules)
  fixableRules.forEach(rule => newRules.delete(rule))
  if (newRules.size > 0) {
    sendRules = true
  }

  const removedRules = new Set(fixableRules)
  currentRules.forEach(rule => removedRules.delete(rule))
  if (removedRules.size > 0) {
    sendRules = true
  }

  if (sendRules) {
    fixableRules.clear()
    currentRules.forEach(rule => fixableRules.add(rule))
  }
}

function lintJob({ cliEngineOptions, contents, eslint, filePath }) {
  const cliEngine = new eslint.CLIEngine(cliEngineOptions)
  const report = cliEngine.executeOnText(contents, filePath)
  updateFixableRules(cliEngine.linter)
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
    const {
      contents, type, config, filePath, projectPath, rules, emitKey
    } = jobConfig
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
      if (sendRules) {
        response.fixableRules = Array.from(fixableRules.keys())
      }
    } else if (type === 'fix') {
      response = fixJob({ cliEngineOptions, contents, eslint, filePath })
    } else if (type === 'debug') {
      const modulesDir = Path.dirname(findCached(fileDir, 'node_modules/eslint') || '')
      response = Helpers.findESLintDirectory(modulesDir, config, projectPath)
    }
    emit(emitKey, response)
  })
}
