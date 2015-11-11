'use babel'

export function spawnWorker() {
  const worker = new CP(__dirname + '/worker.js')
  function killer() {
    worker.kill()
  }
  process.on('exit', killer)
  return {worker, subscription: {dispose: function() {
    process.removeListener('exit', killer)
  }}}
}
