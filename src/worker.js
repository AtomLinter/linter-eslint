'use babel'
// Note: 'use babel' doesn't work in forked processes
process.title = 'linter-eslint helper'

import Path from 'path'
import * as Helpers from './worker-helpers'
import { create } from 'process-communication'
import { FindCache } from 'atom-linter'

const IGNORED_MESSAGE =
  'File ignored because of your .eslintignore file. Use --no-ignore to override.'

function lintJob(argv, contents, eslint, configPath, config) {
  if (configPath === null && config.disableWhenNoEslintConfig) {
    return []
  }
  eslint.execute(argv, contents)
  return global.__LINTER_ESLINT_RESPONSE
    .filter(e => e.message !== IGNORED_MESSAGE)
}
function fixJob(argv, eslint) {
  try {
    eslint.execute(argv)
    return 'Linter-ESLint: Fix Complete'
  } catch (err) {
    throw new Error('Linter-ESLint: Fix Attempt Completed, Linting Errors Remain')
  }
}

create().onRequest('job', ({ contents, type, config, filePath }, job) => {
  global.__LINTER_ESLINT_RESPONSE = []

  if (config.disableFSCache) {
    FindCache.clear()
  }

  const fileDir = Path.dirname(filePath)
  const eslint = Helpers.getESLintInstance(fileDir, config)
  const configPath = Helpers.getConfigPath(fileDir)
  const relativeFilePath = Helpers.getRelativePath(fileDir, filePath, config)

  const argv = Helpers.getArgv(type, config, relativeFilePath, fileDir, configPath)

  if (type === 'lint') {
    job.response = lintJob(argv, contents, eslint, configPath, config)
  } else if (type === 'fix') {
    job.response = fixJob(argv, eslint)
  }
})

process.exit = function () { /* Stop eslint from closing the daemon */ }
