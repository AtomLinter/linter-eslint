'use babel'

import ChildProcess from 'child_process'
import { createFromProcess } from 'process-communication'
import { join } from 'path'

/* eslint-disable import/no-extraneous-dependencies, import/extensions */
import { Disposable } from 'atom'
/* eslint-enable import/no-extraneous-dependencies, import/extensions */

const RULE_OFF_SEVERITY = 0

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

  return {
    worker,
    subscription: new Disposable(() => {
      worker.kill()
    })
  }
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

export function idsToIgnoredRules(ruleIds = []) {
  return ruleIds.reduce((ids, id) => {
    ids[id] = RULE_OFF_SEVERITY
    return ids
  }, {})
}
