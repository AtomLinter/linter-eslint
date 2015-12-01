'use strict'
// Note: 'use babel' doesn't work in forked processes
process.title = 'linter-eslint helper'

import Path from 'path'
import CP from 'childprocess-promise'
import resolveEnv from 'resolve-end'
import * as Helpers from './helpers'

const Communication = new CP()

Communication.on('JOB', function(Job) {
  global.__LINTER_RESPONSE = []

  const params = Job.Message
  const ignoreFile = Helpers.getIgnoresFile(params.fileDir)
  const configFile = Helpers.getEslintConfig(params.fileDir)
  const {eslint, eslintDirectory} = Helpers.getEslint(params)

  if (params.canDisable && configFile === null) {
    Job.Response = []
    return Job.Response
  }


  Job.Response = new Promise(function(resolve) {
    let filePath
    if (ignoreFile) {
      filePath = Path.relative(ignoreFile, params.filePath)
      process.chdir(ignoreFile)
    } else {
      filePath = Path.basename(params.filePath)
      process.chdir(params.fileDir)
    }

    const argv = [
      process.execPath,
      eslintDirectory,
      '--stdin',
      '--format',
      Path.join(__dirname, 'reporter.js')
    ]
    if (params.rulesDir) {
      let rulesDir = resolveEnv(params.rulesDir)
      if (!Path.isAbsolute(rulesDir)) {
        rulesDir = find(params.fileDir, rulesDir)
      }
      argv.push('--rulesdir', rulesDir)
    }
    if (configFile !== null) {
      argv.push('--config', resolveEnv(configFile))
    }
    if (params.disableIgnores) {
      argv.push('--no-ignore')
    }
    argv.push('--stdin-filename', filePath)
    process.argv = argv

    eslint.execute(process.argv, params.contents)
    resolve(global.__LINTER_RESPONSE)
  })
})

Communication.on('FIX', function(Job) {
  const params = Job.Message
  const {eslint, eslintDirectory} = Helpers.getEslint(params)
  const configFile = Helpers.getEslintConfig(params)

  const argv = [
    process.execPath,
    eslintDirectory,
    params.filePath,
    '--fix'
  ]
  if (configFile !== null) {
    argv.push('--config', resolveEnv(configFile))
  }
  process.argv = argv
  process.chdir(params.fileDir)

  try {
    eslint.execute(process.argv)
  } catch (_) {
    throw new Error('Linter-ESLint: Fix Attempt Completed, Linting Errors Remain')
  }
  return 'Linter-ESLint: Fix Complete'
})

process.exit = function() { /* Stop eslint from closing the daemon */ }
