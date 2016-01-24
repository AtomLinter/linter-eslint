'use babel'

import ChildProcess from 'child_process'
import {Disposable} from 'atom'
import {createFromProcess} from 'process-communication'

export function spawnWorker() {
  const env = Object.create(process.env)

  delete env.NODE_PATH
  delete env.NODE_ENV
  delete env.OS

  const child = ChildProcess.fork(__dirname + '/worker.js', [], {env, silent: true})
  const worker = createFromProcess(child)

  child.stdout.on('data', function (chunk) {
    console.log('[Linter-ESLint] STDOUT', chunk.toString())
  })
  child.stderr.on('data', function (chunk) {
    console.log('[Linter-ESLint] STDERR', chunk.toString())
  })

  return {worker, subscription: new Disposable(function() {
    worker.kill()
  })}
}
