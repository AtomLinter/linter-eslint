'use strict'
// Note: 'use babel' doesn't work in forked processes
process.title = 'linter-eslint helper'

const CP = require('childprocess-promise')
const ChildProcess = require('child_process')
const Path = require('path')
const FS = require('fs')

const Communication = new CP()

let oldGlobal = null
let oldEslintPath = null
let eslint = null

function findFile(startDir, name) {
  let filePath
  const chunks = startDir.split(Path.sep)
  while (chunks.length) {
    filePath = Path.join(chunks.join(Path.sep), name)
    try {
      FS.accessSync(filePath, FS.R_OK)
      return filePath
    } catch (_) { }
    chunks.pop()
  }
  return null
}

process.on('uncaughtException', function() { /* No Op */  })

Communication.on('JOB', function(job) {
  const params = job.Message
  global.__LINTER_RESPONSE = []

  if (params.canDisable) {
    const configFile = findFile(params.fileDir, '.eslintrc')
    if (configFile === null) {
      job.Response = []
      return
    }
  }

  let modulesPath = findFile(params.fileDir, 'node_modules')
  if (modulesPath) {
    modulesPath = modulesPath.split(Path.sep)
    modulesPath.pop()
    process.env.NODE_PATH = modulesPath.join(Path.sep)
  } else process.env.NODE_PATH = ''
  require('module').Module._initPaths()

  process.chdir(params.fileDir)

  if (params.global !== oldGlobal) {
    try {
      const eslintPath = params.global ?
        Path.join(
          ChildProcess.spawnSync('npm', ['get', 'prefix'])
            .output[1].toString().trim(), 'lib'
        ) :
        Path.join(__dirname, '..')
      eslint = require(Path.join(eslintPath, 'node_modules', 'eslint', 'lib', 'cli.js'))
      oldEslintPath = eslintPath
    } catch (e) {
      throw new Error('ESLint not found, Please install or make sure Atom is getting $PATH correctly')
    }
    oldGlobal = params.global
  }

  job.Response = new Promise(function(resolve) {
    process.argv = [
      process.execPath,
      oldEslintPath,
      '--stdin',
      '--format',
      Path.join(__dirname, 'reporter.js'),
      params.filePath
    ]
    eslint.execute(process.argv, params.contents)
    resolve(global.__LINTER_RESPONSE)
  })
})

process.exit = function() { /* Stop eslint from closing the daemon */ }
