'use babel'

import ChildProcess from 'child_process'
import CP from 'childprocess-promise'
import Path from 'path'

export function spawnWorker() {
  const env = Object.create(process.env)
  delete env.NODE_PATH
  delete env.NODE_ENV
  const child = ChildProcess.fork(__dirname + '/worker.js', [], {env})
  const worker = new CP(child)
  function killer() {
    child.kill()
  }
  process.on('exit', killer)
  return {worker, subscription: {dispose: function() {
    killer()
    process.removeListener('exit', killer)
  }}}
}
