'use strict'
// Note: 'use babel' doesn't work in forked processes
process.title = 'linter-eslint helper'

const CP = require('childprocess-promise')
const ChildProcess = require('child_process')
const Path = require('path')
const FS = require('fs')

const Communication = new CP()

let oldGlobal = null
let eslintPath = null
let eslint = null

function find(startDir, name) {
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

Communication.on('JOB', function(job) {
  const params = job.Message
  global.__LINTER_RESPONSE = []

  if (params.canDisable) {
    const configFile = find(params.fileDir, '.eslintrc')
    if (configFile === null) {
      job.Response = []
      return
    }
  }

  let modulesPath = find(params.fileDir, 'node_modules')
  let eslintNewPath = null
  if (modulesPath) {
    modulesPath = modulesPath.split(Path.sep)
    modulesPath.pop()
    modulesPath = modulesPath.join(Path.sep)
    process.env.NODE_PATH = modulesPath
    try {
      FS.accessSync(eslintNewPath = Path.join(modulesPath, 'eslint'), FS.R_OK)
    } catch (_) {
      eslintNewPath = null
    }
  } else process.env.NODE_PATH = ''
  require('module').Module._initPaths()

  process.chdir(params.fileDir)

  if (params.global !== oldGlobal) {
    eslintNewPath = params.global ?
      Path.join(
        ChildProcess.spawnSync('npm', ['get', 'prefix'])
          .output[1].toString().trim(), 'lib'
      ) : FS.realpathSync(Path.join(__dirname, '..'))
    oldGlobal = params.global
  }

  if (eslintNewPath !== null && eslintNewPath !== eslintPath) {
    try {
      eslint = require(Path.join(eslintNewPath, 'node_modules', 'eslint', 'lib', 'cli.js'))
      eslintPath = eslintNewPath
    } catch (e) {
      throw new Error('ESLint not found, Please install or make sure Atom is getting $PATH correctly')
    }
  }

  job.Response = new Promise(function(resolve) {
    process.argv = [
      process.execPath,
      eslintPath,
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
