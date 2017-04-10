'use babel'

// Note: 'use babel' doesn't work in forked processes

import Path from 'path'
import { create } from 'process-communication'
import { FindCache, findCached } from 'atom-linter'
import * as Helpers from './worker-helpers'
import isConfigAtHomeRoot from './is-config-at-home-root'

process.title = 'linter-eslint helper'

const ignoredMessages = [
  // V1
  'File ignored because of your .eslintignore file. Use --no-ignore to override.',
  // V2
  'File ignored because of a matching ignore pattern. Use --no-ignore to override.',
  // V2.11.1
  'File ignored because of a matching ignore pattern. Use "--no-ignore" to override.',
  // supress warning that the current file is ignored by eslint by default
  'File ignored by default.  Use a negated ignore pattern (like "--ignore-pattern \'!<relative'
    + '/path/to/filename>\'") to override.',
  'File ignored by default. Use "--ignore-pattern \'!node_modules/*\'" to override.',
  'File ignored by default. Use "--ignore-pattern \'!bower_components/*\'" to override.',
]

function shouldBeReported(problem) {
  return !ignoredMessages.includes(problem.message)
}

function lintJob({ cliEngineOptions, contents, eslint, filePath }) {
  const cliEngine = new eslint.CLIEngine(cliEngineOptions)

  return typeof contents === 'string'
    ? cliEngine.executeOnText(contents, filePath)
    : cliEngine.executeOnFiles([filePath])
}

function fixJob({ cliEngineOptions, eslint, filePath }) {
  const report = lintJob({ cliEngineOptions, eslint, filePath })

  eslint.CLIEngine.outputFixes(report)

  if (!report.results.length || !report.results[0].messages.filter(shouldBeReported).length) {
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
    job.response = report.results.length ? report.results[0].messages.filter(shouldBeReported) : []
  } else if (type === 'fix') {
    job.response = fixJob({ cliEngineOptions, eslint, filePath })
  } else if (type === 'debug') {
    const modulesDir = Path.dirname(findCached(fileDir, 'node_modules/eslint') || '')
    job.response = Helpers.findESLintDirectory(modulesDir, config)
  }
})
