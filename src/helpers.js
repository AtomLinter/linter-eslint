'use babel'

import ChildProcess from 'child_process'
import { createFromProcess } from 'process-communication'
import { join } from 'path'
import escapeHTML from 'escape-html'
import ruleURI from 'eslint-rule-documentation'
import { generateRange } from 'atom-linter'

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
import { Disposable, Range } from 'atom'

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

function validatePoint(textEditor, line, col) {
  const buffer = textEditor.getBuffer()
  // Clip the given point to a valid one, and check if it equals the original
  if (!buffer.clipPosition([line, col]).isEqual([line, col])) {
    throw new Error(`${line}:${col} isn't a valid point!`)
  }
}

export async function getDebugInfo(worker) {
  const textEditor = atom.workspace.getActiveTextEditor()
  let filePath
  let editorScopes
  if (atom.workspace.isTextEditor(textEditor)) {
    filePath = textEditor.getPath()
    editorScopes = textEditor.getLastCursor().getScopeDescriptor().getScopesArray()
  } else {
    // Somehow this can be called with no active TextEditor, impossible I know...
    filePath = 'unknown'
    editorScopes = ['unknown']
  }
  const packagePath = atom.packages.resolvePackagePath('linter-eslint')
  let linterEslintMeta
  if (packagePath === undefined) {
    // Apparently for some users the package path fails to resolve
    linterEslintMeta = { version: 'unknown!' }
  } else {
    // eslint-disable-next-line import/no-dynamic-require
    linterEslintMeta = require(join(packagePath, 'package.json'))
  }
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
      editorScopes,
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
    `Using ${debug.eslintType} ESLint from: ${debug.eslintPath}`,
    `Current file's scopes: ${JSON.stringify(debug.editorScopes, null, 2)}`,
    `linter-eslint configuration: ${JSON.stringify(debug.linterEslintConfig, null, 2)}`
  ]
  return details.join('\n')
}

const generateInvalidTrace = async (
  msgLine, msgCol, msgEndLine, msgEndCol,
  eslintFullRange, filePath, textEditor, ruleId, message, worker
) => {
  let errMsgRange = `${msgLine + 1}:${msgCol}`
  if (eslintFullRange) {
    errMsgRange += ` - ${msgEndLine + 1}:${msgEndCol + 1}`
  }
  const rangeText = `Requested ${eslintFullRange ? 'start point' : 'range'}: ${errMsgRange}`
  const issueURL = 'https://github.com/AtomLinter/linter-eslint/issues/new'
  const titleText = `Invalid position given by '${ruleId}'`
  const title = encodeURIComponent(titleText)
  const body = encodeURIComponent([
    'ESLint returned a point that did not exist in the document being edited.',
    `Rule: \`${ruleId}\``,
    rangeText,
    '', '',
    '<!-- If at all possible, please include code to reproduce this issue! -->',
    '', '',
    'Debug information:',
    '```json',
    JSON.stringify(await getDebugInfo(worker), null, 2),
    '```'
  ].join('\n'))
  const newIssueURL = `${issueURL}?title=${title}&body=${body}`
  return {
    type: 'Error',
    severity: 'error',
    html: `${escapeHTML(titleText)}. See the trace for details. ` +
      `<a href="${newIssueURL}">Report this!</a>`,
    filePath,
    range: generateRange(textEditor, 0),
    trace: [
      {
        type: 'Trace',
        text: `Original message: ${ruleId} - ${message}`,
        filePath,
        severity: 'info',
      },
      {
        type: 'Trace',
        text: rangeText,
        filePath,
        severity: 'info',
      },
    ]
  }
}

/**
 * Given a raw response from ESLint, this processes the messages into a format
 * compatible with the Linter API.
 * @param  {Object}     response   The raw response from ESLint
 * @param  {TextEditor} textEditor The Atom::TextEditor of the file the messages belong to
 * @param  {bool}       showRule   Whether to show the rule in the messages
 * @param  {Object}     worker     The current Worker process to send Debug jobs to
 * @return {Promise}               The messages transformed into Linter messages
 */
export async function processESLintMessages(response, textEditor, showRule, worker) {
  return Promise.all(response.map(async ({
    message, line, severity, ruleId, column, fix, endLine, endColumn
  }) => {
    const filePath = textEditor.getPath()
    const textBuffer = textEditor.getBuffer()
    let linterFix = null
    if (fix) {
      const fixRange = new Range(
        textBuffer.positionForCharacterIndex(fix.range[0]),
        textBuffer.positionForCharacterIndex(fix.range[1])
      )
      linterFix = {
        range: fixRange,
        newText: fix.text
      }
    }
    let msgCol
    let msgEndLine
    let msgEndCol
    let eslintFullRange = false

    /*
     Note: ESLint positions are 1-indexed, while Atom expects 0-indexed,
     positions. We are subtracting 1 from these values here so we don't have to
     keep doing so in later uses.
     */
    const msgLine = line - 1
    if (typeof endColumn !== 'undefined' && typeof endLine !== 'undefined') {
      eslintFullRange = true
      // Here we always want the column to be a number
      msgCol = Math.max(0, column - 1)
      msgEndLine = endLine - 1
      msgEndCol = endColumn - 1
    } else {
      // We want msgCol to remain undefined if it was initially so
      // `generateRange` will give us a range over the entire line
      msgCol = typeof column !== 'undefined' ? column - 1 : column
    }

    let ret
    let range
    try {
      if (eslintFullRange) {
        validatePoint(textEditor, msgLine, msgCol)
        validatePoint(textEditor, msgEndLine, msgEndCol)
        range = [[msgLine, msgCol], [msgEndLine, msgEndCol]]
      } else {
        range = generateRange(textEditor, msgLine, msgCol)
      }
      ret = {
        filePath,
        type: severity === 1 ? 'Warning' : 'Error',
        range
      }

      if (showRule) {
        const elName = ruleId ? 'a' : 'span'
        const href = ruleId ? ` href="${ruleURI(ruleId).url}"` : ''
        ret.html = `${escapeHTML(message)} (<${elName}${href}>${ruleId || 'Fatal'}</${elName}>)`
      } else {
        ret.text = message
      }
      if (linterFix) {
        ret.fix = linterFix
      }
    } catch (err) {
      if (!err.message.startsWith('Line number ') &&
        !err.message.startsWith('Column start ')
      ) {
        // This isn't an invalid point error from `generateRange`, re-throw it
        throw err
      }
      ret = await generateInvalidTrace(
        msgLine, msgCol, msgEndLine, msgEndCol,
        eslintFullRange, filePath, textEditor, ruleId, message, worker
      )
    }

    return ret
  }))
}
