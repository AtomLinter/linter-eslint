import { join } from 'path'
import { generateRange } from 'atom-linter'
import { randomBytes } from 'crypto'
import { promisify } from 'util'
// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
import { Range, Task } from 'atom'
// eslint-disable-next-line import/no-unresolved
import { shell } from 'electron'
import Rules from './rules'
import { throwIfInvalidPoint } from './validate/editor'

const asyncRandomBytes = promisify(randomBytes)
export const rules = new Rules()
let worker = null
let isIncompatibleEslintVersion = false
let seenIncompatibleVersionNotification = false

/**
 * Start the worker process if it hasn't already been started
 */
export function startWorker() {
  if (worker === null) {
    worker = new Task(require.resolve('./worker.js'))
  }

  worker.on('log', (obj) => {
    try {
      console.log(JSON.parse(obj))
    } catch (ex) {
      console.log(obj)
    }
  })

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
 * Forces the worker Task to kill itself
 */
export function killWorker() {
  if (worker !== null) {
    worker.terminate()
    worker = null
  }
}

export function isIncompatibleEslint() {
  return isIncompatibleEslintVersion
}

/**
 * Send a job to the worker and return the results
 * @param  {Object} config Configuration for the job to send to the worker
 * @return {Object|String|Error}        The data returned from the worker
 */
export async function sendJob(config) {
  if (worker && !worker.childProcess.connected) {
    // Sometimes the worker dies and becomes disconnected
    // When that happens, it seems that there is no way to recover other
    // than to kill the worker and create a new one.
    killWorker()
  }

  // Ensure the worker is started
  startWorker()

  // Expand the config with a unique ID to emit on
  // NOTE: Jobs _must_ have a unique ID as they are completely async and results
  // can arrive back in any order.
  // eslint-disable-next-line no-param-reassign
  config.emitKey = (await asyncRandomBytes(5)).toString('hex') // 5 bytes = 10 hex characters

  return new Promise((resolve, reject) => {
    // All worker errors are caught and re-emitted along with their associated
    // emitKey, so that we do not create multiple listeners for the same
    // 'task:error' event
    const errSub = worker.on(`workerError:${config.emitKey}`, ({ msg, stack, name }) => {
      // Re-throw errors from the task
      const error = new Error(msg)
      // Set the stack to the one given to us by the worker
      error.stack = stack
      error.name = name
      errSub.dispose()
      // eslint-disable-next-line no-use-before-define
      responseSub.dispose()
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
      errSub.dispose()
      responseSub.dispose()
      console.error(e)
    }
  })
}

export async function getDebugInfo() {
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
    const response = await sendJob({
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

export async function generateDebugString() {
  const debug = await getDebugInfo()
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

/**
 * Turn the given options into a Linter message array
 * @param  {TextEditor} textEditor The TextEditor to use to build the message
 * @param  {Object} options    The parameters used to fill in the message
 * @param  {string} [options.severity='error'] Can be one of: 'error', 'warning', 'info'
 * @param  {string} [options.excerpt=''] Short text to use in the message
 * @param  {string|Function} [options.description] Used to provide additional information
 * @return {import("atom/linter").Message[]} Message to user generated from the parameters
 */
export function generateUserMessage(textEditor, options) {
  const {
    severity = 'error',
    excerpt = '',
    description,
  } = options
  return [{
    severity,
    excerpt,
    description,
    location: {
      file: textEditor.getPath(),
      position: generateRange(textEditor),
    },
  }]
}

function isNewPackageInstalled() {
  return atom.packages.isPackageLoaded('linter-eslint-node')
   || atom.packages.isPackageDisabled('linter-eslint-node')
}

function showIncompatibleVersionNotification(message) {
  const notificationEnabled = atom.config.get('linter-eslint.advanced.showIncompatibleVersionNotification')
  if (!notificationEnabled || seenIncompatibleVersionNotification || isNewPackageInstalled()) {
    return
  }

  // Show this message only once per session.
  seenIncompatibleVersionNotification = true
  const notification = atom.notifications.addWarning(
    'linter-eslint: Incompatible version',
    {
      description: message,
      dismissable: true,
      buttons: [
        {
          text: 'Install linter-eslint-node',
          onDidClick() {
            shell.openExternal('https://atom.io/packages/linter-eslint-node')
            notification.dismiss()
          }
        },
        {
          text: 'Don\'t show this notification again',
          onDidClick() {
            atom.config.set('linter-eslint.advanced.showIncompatibleVersionNotification', false)
            notification.dismiss()
          }
        }
      ]
    }
  )
}

/**
 * Generates a message to the user in order to nicely display the Error being
 * thrown instead of depending on generic error handling.
 * @param  {import("atom").TextEditor} textEditor The TextEditor to use to build the message
 * @param  {Error} error      Error to generate a message for
 * @return {import("atom/linter").Message[]} Message to user generated from the Error
 */
export function handleError(textEditor, error) {
  const { stack, message, name } = error
  // We want this specific worker error to show up as a notification so that we
  // can include a button for installing the new package.
  if (name === 'IncompatibleESLintError') {
    isIncompatibleEslintVersion = true
    killWorker()
    showIncompatibleVersionNotification(message)
    return
  }
  // Only show the first line of the message as the excerpt
  const excerpt = `Error while running ESLint: ${message.split('\n')[0]}.`
  const description = `<div style="white-space: pre-wrap">${message}\n<hr />${stack}</div>`
  // eslint-disable-next-line consistent-return
  return generateUserMessage(textEditor, { severity: 'error', excerpt, description })
}

const generateInvalidTrace = async ({
  msgLine, msgCol, msgEndLine, msgEndCol,
  eslintFullRange, filePath, textEditor, ruleId, message
}) => {
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
    JSON.stringify(await getDebugInfo(), null, 2),
    '```'
  ].join('\n'))

  const location = {
    file: filePath,
    position: generateRange(textEditor, 0),
  }
  const newIssueURL = `${issueURL}?title=${title}&body=${body}`

  return {
    severity: 'error',
    excerpt: `${titleText}. See the description for details. `
      + 'Click the URL to open a new issue!',
    url: newIssueURL,
    location,
    description: `${rangeText}\nOriginal message: ${message}`
  }
}

/**
 * Given a raw response from ESLint, this processes the messages into a format
 * compatible with the Linter API.
 * @param  {Object}     messages   The messages from ESLint's response
 * @param  {TextEditor} textEditor The Atom::TextEditor of the file the messages belong to
 * @param  {bool}       showRule   Whether to show the rule in the messages
 * @return {Promise}               The messages transformed into Linter messages
 */
export async function processESLintMessages(messages, textEditor, showRule) {
  return Promise.all(messages.map(async ({
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
    if (typeof endColumn === 'number' && typeof endLine === 'number') {
      eslintFullRange = true
      // Here we always want the column to be a number
      msgCol = Math.max(0, column - 1)
      msgEndLine = endLine - 1
      msgEndCol = endColumn - 1
    } else {
      // We want msgCol to remain undefined if it was initially so
      // `generateRange` will give us a range over the entire line
      msgCol = typeof column === 'number' ? column - 1 : column
    }

    let ret = {
      severity: severity === 1 ? 'warning' : 'error',
      location: {
        file: filePath,
      }
    }

    if (ruleId) {
      ret.url = rules.getRuleUrl(ruleId)
    }

    // HACK for https://github.com/AtomLinter/linter-eslint/issues/1249
    let fixLineEnding = false
    if (ruleId === 'prettier/prettier' && (message === 'Delete `␍`')) {
      fixLineEnding = true
    }

    let range
    try {
      if (eslintFullRange) {
        if (!fixLineEnding) {
          throwIfInvalidPoint(textBuffer, msgLine, msgCol)
          throwIfInvalidPoint(textBuffer, msgEndLine, msgEndCol)
        }
        range = [[msgLine, msgCol], [msgEndLine, msgEndCol]]
      } else {
        range = generateRange(textEditor, msgLine, msgCol)
      }
      ret.location.position = range

      const ruleAppendix = showRule ? ` (${ruleId || 'Fatal'})` : ''
      ret.excerpt = `${message}${ruleAppendix}`

      if (linterFix) {
        ret.solutions = [linterFix]
      }
    } catch (err) {
      ret = await generateInvalidTrace({
        msgLine,
        msgCol,
        msgEndLine,
        msgEndCol,
        eslintFullRange,
        filePath,
        textEditor,
        ruleId,
        message,
      })
    }

    return ret
  }))
}

/**
 * Processes the response from the lint job
 * @param  {Object}     response   The raw response from the job
 * @param  {TextEditor} textEditor The Atom::TextEditor of the file the messages belong to
 * @param  {bool}       showRule   Whether to show the rule in the messages
 * @return {Promise}               The messages transformed into Linter messages
 */
export async function processJobResponse(response, textEditor, showRule) {
  if (Object.prototype.hasOwnProperty.call(response, 'updatedRules')) {
    rules.replaceRules(response.updatedRules)
  }
  return processESLintMessages(response.messages, textEditor, showRule)
}
