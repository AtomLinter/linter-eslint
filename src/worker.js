'use babel'

// Note: 'use babel' doesn't work in forked processes

import Path from 'path'
import { create } from 'process-communication'
import { FindCache, findCached } from 'atom-linter'
import * as Helpers from './worker-helpers'
import { isConfigAtHomeRoot } from './is-config-at-home-root'

process.title = 'linter-eslint helper'

function lintJob({ cliEngineOptions, contents, eslint, filePath }) {
  const cliEngine = new eslint.CLIEngine(cliEngineOptions)

  return typeof contents === 'string'
    ? cliEngine.executeOnText(contents, filePath)
    : cliEngine.executeOnFiles([filePath])
}

function fixJob({ cliEngineOptions, contents, eslint, filePath }) {
  const report = lintJob({ cliEngineOptions, contents, eslint, filePath })

  eslint.CLIEngine.outputFixes(report)

  if (!report.results.length || !report.results[0].messages.length) {
    return 'Linter-ESLint: Fix complete.'
  }
  return 'Linter-ESLint: Fix attempt complete, but linting errors remain.'
}

create().onRequest('job', ({ contents, type, config, filePath, projectPath, rules }, job) => {
  if (config.disableFSCache) {
    FindCache.clear()
  }

  const fileDir = Path.dirname(filePath)
  const eslint = Helpers.getESLintInstance(fileDir, config, projectPath)
  const configPath = Helpers.getConfigPath(fileDir)
  const relativeFilePath = Helpers.getRelativePath(fileDir, filePath, config)

  const cliEngineOptions = Helpers.getCLIEngineOptions(
    type, config, rules, relativeFilePath, fileDir, configPath
  )

  const noProjectConfig = (configPath === null || isConfigAtHomeRoot(configPath))
  if (noProjectConfig && config.disableWhenNoEslintConfig) {
    job.response = []
  } else if (type === 'lint') {
    const report = lintJob({ cliEngineOptions, contents, eslint, filePath })
    job.response = report.results.length ? report.results[0].messages : []
  } else if (type === 'fix') {
    job.response = fixJob({ cliEngineOptions, contents, eslint, filePath })
  } else if (type === 'debug') {
    const modulesDir = Path.dirname(findCached(fileDir, 'node_modules/eslint') || '')
    job.response = Helpers.findESLintDirectory(modulesDir, config)
  }
})
