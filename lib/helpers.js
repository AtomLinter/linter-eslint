'use babel'

import CP from 'childprocess-promise'

export function spawnWorker() {
  const worker = new CP(__dirname + '/worker.js')
  function killer() {
    worker.kill()
  }
  process.on('exit', killer)
  return {worker, subscription: {dispose: function() {
    killer()
    process.removeListener('exit', killer)
  }}}
}
