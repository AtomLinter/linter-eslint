'use babel'

/* global emit */

import { FindCache } from 'atom-linter'
import { dirname } from 'path'

import getCLIEngineOptions from './cli-engine-options'
import { isLintDisabled } from '../eslint-config-inspector'
import {
  cdToProjectRoot,
  findCachedDir,
  findEslintDirCurried,
  getEslintInstance,
  getModulesDirAndRefresh
} from '../file-system'
import {
  didChange as rulesDidChange,
  fromCliEngine as rulesFromEngine,
} from '../rules'

process.title = 'linter-eslint helper'

let knownRules = new Map()

function lintJob({
  cliEngineOptions, contents, eslint, filePath, toFix
}) {
  const cliEngine = new eslint.CLIEngine(cliEngineOptions)
  const report = cliEngine.executeOnText(contents, filePath)
  const updatedRules = rulesFromEngine(cliEngine)
  const response = {
    messages: report.results.length ? report.results[0].messages : []
  }
  if (rulesDidChange(knownRules, updatedRules)) {
    knownRules = updatedRules
    // Cannot emit Maps. Convert to Array of Arrays to send back.
    response.updatedRules = Array.from(knownRules)
  }
  return toFix
    ? toFix({ report, outputFixes: eslint.CLIEngine.outputFixes })
    : response
}

const toFix = ({ report, outputFixes }) => {
  outputFixes(report)
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

      const findEslintDir = findEslintDirCurried({
        projectPath,
        useGlobalEslint,
        globalNodePath,
        advancedLocalNodeModules
      })

      const fileDir = dirname(filePath)
      const modulesDir = getModulesDirAndRefresh(fileDir)
      const { path: eslintDir } = findEslintDir(modulesDir)

      const eslint = getEslintInstance(eslintDir)

      if (isLintDisabled({ fileDir, disableWhenNoEslintConfig })) {
        emit(emitKey, { messages: [] })
        return
      }

      const cliEngineOptions = getCLIEngineOptions({
        type,
        rules,
        fileDir,
        disableEslintIgnore,
        eslintRulesDirs,
        eslintrcPath
      })

      // ESLint does some of it's own searching for project files. Make
      //  sure it does that search from the correct working directory
      cdToProjectRoot({ disableEslintIgnore, projectPath, fileDir })

      const responses = {
        lint: () => lintJob({ cliEngineOptions, contents, eslint, filePath }),

        fix: () => lintJob({
          cliEngineOptions, contents, eslint, filePath, toFix
        }),

        debug: () =>
          findEslintDir(findCachedDir(fileDir, 'node_modules/eslint'))
      }
      const response = responses[type]()
      emit(emitKey, response)
    } catch (workerErr) {
      emit(`workerError:${emitKey}`, { msg: workerErr.message, stack: workerErr.stack })
    }
  })
}
