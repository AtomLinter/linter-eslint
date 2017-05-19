'use babel'

import { join } from 'path'
import ruleURI from 'eslint-rule-documentation'
import { generateRange } from 'atom-linter'
import cryptoRandomString from 'crypto-random-string'

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
import { Range } from 'atom'

/**
 * Start the worker process if it hasn't already been started
 * @param  {Task} worker The worker process reference to act on
 * @return {undefined}
 */
const startWorker = (worker) => {
  if (worker.started) {
    // Worker start request has already been sent
    return
  }
  // Send empty arguments as we don't use them in the worker
  worker.start([])
  // NOTE: Modifies the Task of the worker, but it's the only clean way to track this
  worker.started = true
}

/**
 * Send a job to the worker and return the results
 * @param  {Task} worker The worker Task to use
 * @param  {Object} config Configuration for the job to send to the worker
 * @return {Object|String|Error}        The data returned from the worker
 */
export async function sendJob(worker, config) {
  // Ensure the worker is started
  startWorker(worker)
  // Expand the config with a unique ID to emit on
  // NOTE: Jobs _must_ have a unique ID as they are completely async and results
  // can arrive back in any order.
  config.emitKey = cryptoRandomString(10)

  return new Promise((resolve, reject) => {
    const errSub = worker.on('task:error', (...err) => {
      // Re-throw errors from the task
      const error = new Error(err[0])
      // Set the stack to the one given to us by the worker
      error.stack = err[1]
      reject(error)
    })
    const responseSub = worker.on(config.emitKey, (data) => {
      errSub.dispose()
      responseSub.dispose()
      resolve(data)
    })
    // Send the job on to the worker
    try {
      worker.send(config)
    } catch (e) {
      console.error(e)
    }
  })
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
    const response = await sendJob(worker, {
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

  const location = {
    file: filePath,
    position: generateRange(textEditor, 0),
  }
  const newIssueURL = `${issueURL}?title=${title}&body=${body}`

  return {
    severity: 'error',
    excerpt: `${titleText}. See the description for details. ` +
      'Click the URL to open a new issue!',
    url: newIssueURL,
    location,
    description: `${rangeText}\nOriginal message: ${message}`
  }
}

/**
 * Given a raw response from ESLint, this processes the messages into a format
 * compatible with the Linter API.
 * @param  {Object}     response   The raw response from ESLint
 * @param  {TextEditor} textEditor The Atom::TextEditor of the file the messages belong to
 * @param  {bool}       showRule   Whether to show the rule in the messages
 * @param  {Object}     worker     The current Worker Task to send Debug jobs to
 * @return {Promise}               The messages transformed into Linter messages
 */
export async function processESLintMessages(response, textEditor, showRule, worker) {
  return Promise.all(response.map(async ({
    fatal, message: originalMessage, line, severity, ruleId, column, fix, endLine, endColumn
  }) => {
    const message = fatal ? originalMessage.split('\n')[0] : originalMessage
    const filePath = textEditor.getPath()
    const textBuffer = textEditor.getBuffer()
    let linterFix = null
    if (fix) {
      const fixRange = new Range(
        textBuffer.positionForCharacterIndex(fix.range[0]),
        textBuffer.positionForCharacterIndex(fix.range[1])
      )
      linterFix = {
        position: fixRange,
        replaceWith: fix.text
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
        severity: severity === 1 ? 'warning' : 'error',
        location: {
          file: filePath,
          position: range
        }
      }

      if (ruleId) {
        ret.url = ruleURI(ruleId).url
      }

      const ruleAppendix = showRule ? ` (${ruleId || 'Fatal'})` : ''
      ret.excerpt = `${message}${ruleAppendix}`

      if (linterFix) {
        ret.solutions = [linterFix]
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
