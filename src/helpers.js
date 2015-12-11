'use babel'

import ChildProcess from 'child_process'
import CP from 'childprocess-promise'
import FS from 'fs'
import Path from 'path'
import {find} from 'atom-linter'

export function spawnWorker() {
  let shouldLive = true
  const env = Object.create(process.env)
  delete env.NODE_PATH
  delete env.NODE_ENV
  const data = {stdout: [], stderr: []}
  const child = ChildProcess.fork(__dirname + '/worker.js', [], {env, silent: true})
  const worker = new CP(child)
  function killer() {
    shouldLive = false
    child.kill()
  }
  child.stdout.on('data', function(chunk) {
    data.stdout.push(chunk)
  })
  child.stderr.on('data', function(chunk) {
    data.stderr.push(chunk)
  })
  child.on('exit', function() {
    if (shouldLive) {
      console.log('ESLint Worker Info', {stdout: data.stdout.join(''), stderr: data.stderr.join('')})
      atom.notifications.addWarning('[Linter-ESLint] Worker died unexpectedly', {detail: 'Check your console for more info. A new worker will be spawned instantly.', dismissable: true})
    }
    child.emit('exit-linter', shouldLive)
  })
  process.on('exit', killer)
  return {child, worker, subscription: {dispose: function() {
    killer()
    process.removeListener('exit', killer)
  }}}
}

let prefixPath = null
const atomEslintPath = Path.normalize(Path.join(__dirname, '..', 'node_modules', 'eslint'))

export function findEslintDir(params) {
  const modulesPath = find(params.fileDir, 'node_modules')
  let eslintNewPath = null

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
      eslintNewPath = atomEslintPath
    }
  }

  return eslintNewPath
}

// Check for project config file or eslint config in package.json and determine
// whether to bail out or use config specified in package options
export function determineConfigFile(params) {
  // config file
  const configFile = find(params.fileDir, ['.eslintrc.js', '.eslintrc.yaml', '.eslintrc.yml', '.eslintrc.json', '.eslintrc']) || null
  if (configFile) {
    return configFile
  }
  // package.json
  const packagePath = find(params.fileDir, 'package.json')
  if (packagePath && Boolean(require(packagePath).eslintConfig)) {
    return packagePath
  }
  // Couldn't find a config
  if (params.canDisable) {
    return null
  }
  // If all else fails, use the configFile specified in the linter-eslint options
  if (params.configFile) {
    return params.configFile
  }
}

export function getEslintCli(path) {
  try {
    const eslint = require(Path.join(path, 'lib', 'cli.js'))
    return eslint
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      throw new Error('ESLint not found, Please install or make sure Atom is getting $PATH correctly')
    } else throw e
  }
}

export {find}
