'use strict'
// Note: 'use babel' doesn't work in forked processes
process.title = 'linter-eslint helper'

const CP = require('childprocess-promise')
const ChildProcess = require('child_process')
const Path = require('path')
const FS = require('fs')
const resolveEnv = require('resolve-env')

const Communication = new CP()

let eslintPath = null
const eslintPathLocal = Path.join(FS.realpathSync(Path.join(__dirname, '..')), 'node_modules', 'eslint')
let eslint = null
let prefixPath = null

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
  let configFile = null
  global.__LINTER_RESPONSE = []

  configFile = find(params.fileDir, '.eslintrc')
  if (params.canDisable && configFile === null) {
    job.Response = []
    return
  } else if (params.configFile) {
    configFile = params.configFile
  }

  const packageJsonPath = find(params.fileDir, 'package.json')
  const eslintignoreDir = Path.dirname(find(params.fileDir, '.eslintignore'))
  let eslintNewPath = null
  let modulesPath = null

  if (packageJsonPath !== null) {
    modulesPath = Path.join(Path.dirname(packageJsonPath), 'node_modules')
  }

  if (modulesPath) {
    process.env.NODE_PATH = modulesPath
  } else process.env.NODE_PATH = ''
  require('module').Module._initPaths()

  process.chdir(params.fileDir)

  if (params.global) {
    if (params.nodePath === '' && prefixPath === null) {
      const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
      try {
        prefixPath = ChildProcess.spawnSync(npmCommand, ['get', 'prefix']).output[1].toString().trim()
      } catch (e) {
        throw new Error('Unable to execute `npm get prefix`. Please make sure Atom is getting $PATH correctly')
      }
    }
    if (process.platform === 'win32') {
      eslintNewPath = Path.join(params.nodePath || prefixPath, 'node_modules', 'eslint')
    } else {
      eslintNewPath = Path.join(params.nodePath || prefixPath, 'lib', 'node_modules', 'eslint')
    }
  } else {
    try {
      FS.accessSync(eslintNewPath = Path.join(modulesPath, 'eslint'), FS.R_OK)
    } catch (_) {
      eslintNewPath = eslintPathLocal
    }
  }

  if (eslintNewPath !== eslintPath) {
    try {
      eslint = require(Path.join(eslintNewPath, 'lib', 'cli.js'))
      eslintPath = eslintNewPath
    } catch (e) {
      if (e.code === 'MODULE_NOT_FOUND') {
        throw new Error('ESLint not found, Please install or make sure Atom is getting $PATH correctly')
      } else throw e
    }
  }

  job.Response = new Promise(function(resolve) {
    const filePath = (eslintignoreDir) ? Path.relative(eslintignoreDir, params.filePath) : params.filePath
    const argv = [
      process.execPath,
      eslintPath,
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
    argv.push('--stdin-filename', filePath)
    process.argv = argv
    eslint.execute(process.argv, params.contents)
    resolve(global.__LINTER_RESPONSE)
  })
})

process.exit = function() { /* Stop eslint from closing the daemon */ }
