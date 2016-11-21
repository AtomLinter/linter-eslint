'use babel'

import ChildProcess from 'child_process'
import { createFromProcess } from 'process-communication'
import { join } from 'path'

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
import { Disposable } from 'atom'

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

export function validatePoint(textEditor, line, col) {
  const buffer = textEditor.getBuffer()
  // Clip the given point to a valid one, and check if it equals the original
  if (!buffer.clipPosition([line, col]).isEqual([line, col])) {
    throw new Error(`${line}:${col} isn't a valid point!`)
  }
}

export async function getDebugInfo(worker) {
  const textEditor = atom.workspace.getActiveTextEditor()
  const filePath = textEditor.getPath()
  const packagePath = atom.packages.resolvePackagePath('linter-eslint')
  // eslint-disable-next-line import/no-dynamic-require
  const linterEslintMeta = require(join(packagePath, 'package.json'))
  const config = atom.config.get('linter-eslint')
  const hoursSinceRestart = Math.round((process.uptime() / 3600) * 10) / 10
  let returnVal
  try {
    const response = await worker.request('job', {
      type: 'debug',
      config,
      filePath
    })
    returnVal = {
      atomVersion: atom.getVersion(),
      linterEslintVersion: linterEslintMeta.version,
      linterEslintConfig: config,
      // eslint-disable-next-line import/no-dynamic-require
      eslintVersion: require(join(response.path, 'package.json')).version,
      hoursSinceRestart,
      platform: process.platform,
      eslintType: response.type,
      eslintPath: response.path,
    }
  } catch (error) {
    atom.notifications.addError(`${error}`)
  }
  return returnVal
}

export async function generateDebugString(worker) {
  const debug = await getDebugInfo(worker)
  const details = [
    `Atom version: ${debug.atomVersion}`,
    `linter-eslint version: ${debug.linterEslintVersion}`,
    `ESLint version: ${debug.eslintVersion}`,
    `Hours since last Atom restart: ${debug.hoursSinceRestart}`,
    `Platform: ${debug.platform}`,
    `Using ${debug.eslintType} ESLint from ${debug.eslintPath}`,
    `linter-eslint configuration: ${JSON.stringify(debug.linterEslintConfig, null, 2)}`
  ]
  return details.join('\n')
}
