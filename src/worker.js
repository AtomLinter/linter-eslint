'use strict'
// Note: 'use babel' doesn't work in forked processes
process.title = 'linter-eslint helper'

import Path from 'path'
import {execFileSync} from 'child_process'
import CP from 'childprocess-promise'
import resolveEnv from 'resolve-end'
import * as Helpers from './helpers'

const Communication = new CP()

let eslint
let lastEslintDirectory

Communication.on('JOB', function(Job) {
  global.__LINTER_RESPONSE = []

  const params = Job.Message
  const modulesPath = Helpers.getModulesDirectory(params.fileDir)
  const ignoreFile = Helpers.getIgnoresFile(params.fileDir)
  const configFile = Helpers.getEslintConfig(params.fileDir)
  const eslintDirectory = Helpers.getEslintDirectory(params, modulesPath)

  if (params.canDisable && configFile === null) {
    return Job.Response = []
  }

  if (eslintDirectory !== lastEslintDirectory) {
    lastEslintDirectory = eslintDirectory
    eslint = Helpers.getEslintFromDirectory(eslintDirectory)
  }

  if (modulesPath) {
    process.env.NODE_PATH = modulesPath
  } else process.env.NODE_PATH = ''
  require('module').Module._initPaths()

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

Communication.on('FIX', function(fixJob) {
  const params = fixJob.Message
  const eslintDir = findEslintDir(params)
  const configFile = determineConfigFile(params)
  const eslintBinPath = Path.normalize(Path.join(eslintDir, 'bin', 'eslint.js'))

  const argv = [
    params.filePath,
    '--fix'
  ]
  if (configFile !== null) {
    argv.push('--config', resolveEnv(configFile))
  }

  fixJob.Response = new Promise(function(resolve, reject) {
    try {
      execFileSync(eslintBinPath, argv, {cwd: params.fileDir})
    } catch (err) {
      reject('Linter-ESLint: Fix Attempt Completed, Linting Errors Remain')
    }
    resolve('Linter-ESLint: Fix Complete')
  })
})

process.exit = function() { /* Stop eslint from closing the daemon */ }
