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

export function ruleURI(ruleId) {
  const ruleParts = ruleId.split('/')

  if (ruleParts.length === 1) {
    return `http://eslint.org/docs/rules/${ruleId}`
  }

  const pluginName = ruleParts[0]
  const ruleName = ruleParts[1]
  switch (pluginName) {
    case 'angular':
      return `https://github.com/Gillespie59/eslint-plugin-angular/blob/master/docs/${ruleName}.md`

    case 'ava':
      return `https://github.com/avajs/eslint-plugin-ava/blob/master/docs/rules/${ruleName}.md`

    case 'import':
      return `https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/${ruleName}.md`

    case 'import-order':
      return `https://github.com/jfmengels/eslint-plugin-import-order/blob/master/docs/rules/${ruleName}.md`

    case 'jasmine':
      return `https://github.com/tlvince/eslint-plugin-jasmine/blob/master/docs/rules/${ruleName}.md`

    case 'jsx-a11y':
      return `https://github.com/evcohen/eslint-plugin-jsx-a11y/blob/master/docs/rules/${ruleName}.md`

    case 'lodash':
      return `https://github.com/wix/eslint-plugin-lodash/blob/master/docs/rules/${ruleName}.md`

    case 'mocha':
      return `https://github.com/lo1tuma/eslint-plugin-mocha/blob/master/docs/rules/${ruleName}.md`

    case 'promise':
      return `https://github.com/xjamundx/eslint-plugin-promise#${ruleName}`

    case 'react':
      return `https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/${ruleName}.md`

    default:
      return 'https://github.com/AtomLinter/linter-eslint/wiki/Linking-to-Rule-Documentation'
  }
}
