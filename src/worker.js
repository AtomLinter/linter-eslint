'use babel'

/* global emit */

import Path from 'path'
import { FindCache, findCached } from 'atom-linter'
import * as Helpers from './worker-helpers'
import isConfigAtHomeRoot from './is-config-at-home-root'

process.title = 'linter-eslint helper'

const fixableRules = new Set()
let sendRules = false

/**
 * Modifies the closed-over fixableRules variable when called _if_ there are
 * newly-loaded fixable rules or fixable rules are removed from the set of all
 * loaded rules, according to the eslint `linter` instance that is passed in.
 *
 * @param  {Object} linter eslint 'linter' instance
 * @return {void}
 */
function updateFixableRules(linter) {
  if (linter === undefined) {
    // ESLint < v4 doesn't support this property
    return
  }

  // Build a set of fixable rules based on the rules loaded in the provided linter
  const currentRules = new Set()
  linter.getRules().forEach((props, rule) => {
    if (
      Object.prototype.hasOwnProperty.call(props, 'meta') &&
      Object.prototype.hasOwnProperty.call(props.meta, 'fixable')
    ) {
      currentRules.add(rule)
    }
  })

  // Unless something has changed, we won't need to send updated set of fixableRules
  sendRules = false

  // Check for new fixable rules added since the last time we sent fixableRules
  const newRules = new Set(currentRules)
  fixableRules.forEach(rule => newRules.delete(rule))
  if (newRules.size > 0) {
    sendRules = true
  }

  // Check for fixable rules that were removed since the last time we sent fixableRules
  const removedRules = new Set(fixableRules)
  currentRules.forEach(rule => removedRules.delete(rule))
  if (removedRules.size > 0) {
    sendRules = true
  }

  if (sendRules) {
    // Rebuild fixableRules
    fixableRules.clear()
    currentRules.forEach(rule => fixableRules.add(rule))
  }
}

function lintJob({ cliEngineOptions, contents, eslint, filePath }) {
  const cliEngine = new eslint.CLIEngine(cliEngineOptions)
  const report = cliEngine.executeOnText(contents, filePath)
  // Use the internal (undocumented) `linter` instance attached to the cliEngine
  // to check the loaded rules (including plugin rules) and update our list of fixable rules.
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
