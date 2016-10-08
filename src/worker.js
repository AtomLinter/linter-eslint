'use babel'

// Note: 'use babel' doesn't work in forked processes

import Path from 'path'
import { create } from 'process-communication'
import { FindCache, findCached } from 'atom-linter'
import * as Helpers from './worker-helpers'

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

function lintJob(argv, contents, eslint, configPath, config) {
  if (configPath === null && config.disableWhenNoEslintConfig) {
    return []
  }
  eslint.execute(argv, contents)
  return global.__LINTER_ESLINT_RESPONSE
    .filter(e => !ignoredMessages.includes(e.message))
}

function fixJob(argv, eslint) {
  try {
    eslint.execute(argv)
    return 'Linter-ESLint: Fix Complete'
  } catch (err) {
    throw new Error('Linter-ESLint: Fix Attempt Completed, Linting Errors Remain')
  }
}

create().onRequest('job', ({ contents, type, config, filePath, projectPath, rules }, job) => {
  global.__LINTER_ESLINT_RESPONSE = []

  if (config.disableFSCache) {
    FindCache.clear()
  }

  const fileDir = Path.dirname(filePath)
  const eslint = Helpers.getESLintInstance(fileDir, config, projectPath)
  const configPath = Helpers.getConfigPath(fileDir)
  const relativeFilePath = Helpers.getRelativePath(fileDir, filePath, config)

  const argv = Helpers.getArgv(type, config, rules, relativeFilePath, fileDir, configPath)

  if (type === 'lint') {
    job.response = lintJob(argv, contents, eslint, configPath, config)
  } else if (type === 'fix') {
    job.response = fixJob(argv, eslint)
  } else if (type === 'debug') {
    const modulesDir = Path.dirname(findCached(fileDir, 'node_modules/eslint') || '')
    job.response = Helpers.findESLintDirectory(modulesDir, config)
  }
})

process.exit = function () { /* Stop eslint from closing the daemon */ }
