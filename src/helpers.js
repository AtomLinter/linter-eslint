'use babel'

import Path from 'path'
import FS from 'fs'
import ChildProcess from 'child_process'
import CP from 'childprocess-promise'
import {findFile as find} from 'atom-linter'

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

export function getModulesDirectory(fileDir) {
  return find(fileDir, 'node_modules')
}

export function getIgnoresFile(fileDir) {
  return Path.dirname(find(fileDir, '.eslintignore'))
}

export function getEslintFromDirectory(path) {
  try {
    return require(Path.join(path, 'lib', 'cli.js'))
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      throw new Error('ESLint not found, Please install or make sure Atom is getting $PATH correctly')
    } else throw e
  }
}

let nodePrefixPath = null

export function getNodePrefixPath() {
  if (nodePrefixPath === null) {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    try {
      nodePrefixPath = ChildProcess.spawnSync(npmCommand, ['get', 'prefix']).output[1].toString().trim()
    } catch (e) {
      throw new Error('Unable to execute `npm get prefix`. Please make sure Atom is getting $PATH correctly')
    }
  }
  return nodePrefixPath
}

let bundledEslintDirectory = null

export function getBundledEslintDirectory() {
  if (bundledEslintDirectory === null) {
    bundledEslintDirectory = Path.normalize(Path.join(__dirname, '..', 'node_modules', 'eslint'))
  }
  return bundledEslintDirectory
}

export function getEslintDirectory(params, modulesPath = null) {
  if (params.global) {
    const prefixPath = getNodePrefixPath()
    if (process.platform === 'win32') {
      return Path.join(params.nodePath || prefixPath, 'node_modules', 'eslint')
    }
    return Path.join(params.nodePath || prefixPath, 'lib', 'node_modules', 'eslint')
  }
  const eslintPath = Path.join(modulesPath || getModulesDirectory(params.fileDir), 'eslint')
  try {
    FS.accessSync(eslintPath, FS.R_OK)
    return eslintPath
  } catch (_) {
    return getBundledEslintDirectory()
  }
}

export function getEslintConfig(params) {
  const configFile = find(params.fileDir, ['.eslintrc.js', '.eslintrc.yaml', '.eslintrc.yml', '.eslintrc.json', '.eslintrc']) || null
  if (configFile) {
    return configFile
  }

  const packagePath = find(params.fileDir, 'package.json')
  if (packagePath && Boolean(require(packagePath).eslintConfig)) {
    return packagePath
  }

  if (params.canDisable) {
    return null
  }

  if (params.configFile) {
    return params.configFile
  }
}

let eslint
let lastEslintDirectory
let lastModulesPath

export function getEslint(params) {
  const modulesPath = getModulesDirectory(params.fileDir)
  const eslintDirectory = getEslintDirectory(params, modulesPath)
  if (eslintDirectory !== lastEslintDirectory) {
    lastEslintDirectory = eslintDirectory
    eslint = getEslintFromDirectory(eslintDirectory)
  }
  if (lastModulesPath !== modulesPath) {
    lastModulesPath = modulesPath
    if (modulesPath) {
      process.env.NODE_PATH = modulesPath
    } else process.env.NODE_PATH = ''
    require('module').Module._initPaths()
  }
  return {eslint, eslintDirectory}
}
