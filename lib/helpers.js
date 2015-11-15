'use babel'

import ChildProcess from 'child_process'
import CP from 'childprocess-promise'

export function spawnWorker() {
  let shouldLive = true
  const env = Object.create(process.env)
  delete env.NODE_PATH
  delete env.NODE_ENV
  const data = {stdout: [], stderr: []}
  const child = ChildProcess.fork(__dirname + '/worker.js', [], {env})
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
      console.log('ESLint Worker Info', data)
      atom.notifications.addWarning('[Linter-ESLint] Worker died unexpectedly', {detail: 'Check your console for more info'})
    }
  })
  process.on('exit', killer)
  return {worker, subscription: {dispose: function() {
    killer()
    process.removeListener('exit', killer)
  }}}
}
