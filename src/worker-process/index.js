'use babel'

/* global emit */

import { FindCache } from 'atom-linter'
import { dirname } from 'path'

import {
  cdToProjectRoot,
  getModulesDirAndRefresh,
  isDirectory
} from '../file-system'

import {
  eslintDirType,
  findEslintDir,
  getEslintInstance
} from './eslint-utils'

import getCLIEngineOptions from './cli-engine-options'
import { isLintDisabled } from '../eslint-config-inspector'
import { diffCachedMap } from '../f-utils'
import { fromCliEngine as rulesFromEngine } from '../rules'


process.title = 'linter-eslint helper'

const diffCachedRules = diffCachedMap(new Map())

const lintJob = ({
  cliEngineOptions,
  contents,
  eslint,
  filePath,
  toFix
}) => {
  const cliEngine = new eslint.CLIEngine(cliEngineOptions)
  const report = cliEngine.executeOnText(contents, filePath)

  const updatedRules = rulesFromEngine(cliEngine)
  const { results } = report

  const rulesDiff = diffCachedRules(updatedRules)

  const messages = {
    lint: () => (results.length ? results[0].messages : []),
    fix: () => toFix({ report, outputFixes: eslint.CLIEngine.outputFixes })
  }

  const response = {
    messages: toFix ? messages.fix() : messages.lint(),
    rulesDiff
  }
  return response
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
    jobId,
    filePath,
    projectPath,
    rules,
    jobType,
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
    // for each jobId, rather than adding multiple listeners for `task:error`
    try {
      if (disableFSCache) {
        FindCache.clear()
      }

      const fileDir = dirname(filePath)

      // TODO This should be moved to worker-manager/send-job.js
      // to avoid sending useless jobs to worker.
      if (isLintDisabled({ fileDir, disableWhenNoEslintConfig })) {
        emit('success', { jobId, response: { messages: [] } })
        return
      }

      const modulesDir = getModulesDirAndRefresh(fileDir)
      const eslintType = eslintDirType({
        useGlobalEslint,
        advancedLocalNodeModules
      })

      const eslintDir = findEslintDir(eslintType)({
        advancedLocalNodeModules,
        globalNodePath,
        modulesDir,
        projectPath
      })

      if (jobType === 'debug') {
        emit('success', {
          jobId,
          response: { eslintType, eslintDir }
        })
        return
      }

      if (eslintType !== 'local project' && !isDirectory(eslintDir)) {
        throw new Error('Invalid directory path for ESLint')
      }

      const eslint = getEslintInstance(eslintDir)

      const cliEngineOptions = getCLIEngineOptions({
        jobType,
        rules,
        fileDir,
        disableEslintIgnore,
        eslintRulesDirs,
        eslintrcPath
      })

      // ESLint does some of it's own searching for project files. Make
      //  sure it does that search from the correct working directory
      cdToProjectRoot({ disableEslintIgnore, projectPath, fileDir })

      const response = {
        lint: () => lintJob({ cliEngineOptions, contents, eslint, filePath }),
        fix: () => lintJob({
          cliEngineOptions,
          contents,
          eslint,
          filePath,
          toFix
        })
      }[jobType]()

      emit('success', { jobId, response })
    } catch (error) {
      const { message, stack } = error
      emit('fail', { jobId, response: { message, stack } })
    }
  })
}
