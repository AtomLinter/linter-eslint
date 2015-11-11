'use strict'
// Note: 'use babel' doesn't work in forked processes
process.title = 'linter-eslint helper'

const CP = require('childprocess-promise')
const ChildProcess = require('child_process')
const Path = require('path')
const Stream = require('stream')

const Communication = new CP()

let wasGlobal = null
let eslint = null

Communication.on('JOB', function(job) {
  const params = job.Message

  process.cwd = params.fileDir
  process.argv = ['', '', params.filePath, '--stdin'] // Node Path, Current File Path, ...args

  if (params.global !== wasGlobal) {
    try {
      let eslintPath = params.global ?
        Path.join(ChildProcess.spawnSync('npm', ['get', 'prefix']).output[1].toString().trim(), 'lib') :
        Path.join(__dirname, '..')
      eslint = require(Path.join(eslintPath, 'node_modules', 'eslint', 'lib', 'cli.js'))
    } catch (e) {
      throw new Error('ESLint not found, Please install or make sure Atom is getting $PATH correctly')
    }
    wasGlobal = params.global
  }

  job.Response = new Promise(function(resolve) {
    eslint.execute(process.argv, params.contents)
    resolve(data)
  })
})
