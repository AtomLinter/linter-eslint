'use babel'

import Path from 'path'
import FS from 'fs'
import ChildProcess from 'child_process'
import CP from 'childprocess-promise'

export const bundledEslintPath = Path.join(FS.realpathSync(Path.join(__dirname, '..')), 'node_modules', 'eslint')

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

export function getCliFromPath(path) {
  try {
    return require(Path.join(path, 'lib', 'cli.js'))
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      throw new Error('ESLint not found, Please install or make sure Atom is getting $PATH correctly')
    } else throw e
  }
}
