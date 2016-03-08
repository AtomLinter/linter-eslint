'use babel'

import ChildProcess from 'child_process'
import { Disposable } from 'atom'
import { createFromProcess } from 'process-communication'
import { join } from 'path'

export function spawnWorker() {
  const env = Object.create(process.env)

  delete env.NODE_PATH
  delete env.NODE_ENV
  delete env.OS

  const child = ChildProcess.fork(join(__dirname, 'worker.js'), [], { env, silent: true })
  const worker = createFromProcess(child)

  child.stdout.on('data', (chunk) => {
    console.log('[Linter-ESLint] STDOUT', chunk.toString())
  })
  child.stderr.on('data', (chunk) => {
    console.log('[Linter-ESLint] STDERR', chunk.toString())
  })

  return { worker, subscription: new Disposable(() => {
    worker.kill()
  }) }
}

export function showError(givenMessage, givenDetail = null) {
  let detail
  let message
  if (message instanceof Error) {
    detail = message.stack
    message = message.message
  } else {
    detail = givenDetail
    message = givenMessage
  }
  atom.notifications.addError(`[Linter-ESLint] ${message}`, {
    detail,
    dismissable: true
  })
}
