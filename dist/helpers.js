"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.generateDebugString = generateDebugString;
exports.generateUserMessage = generateUserMessage;
exports.getDebugInfo = getDebugInfo;
exports.handleError = handleError;
exports.isIncompatibleEslint = isIncompatibleEslint;
exports.killWorker = killWorker;
exports.processESLintMessages = processESLintMessages;
exports.processJobResponse = processJobResponse;
exports.rules = void 0;
exports.sendJob = sendJob;
exports.startWorker = startWorker;

var _path = require("path");

var _atomLinter = require("atom-linter");

var _crypto = require("crypto");

var _util = require("util");

var _atom = require("atom");

var _electron = require("electron");

var _rules = _interopRequireDefault(require("./rules"));

var _editor = require("./validate/editor");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
// eslint-disable-next-line import/no-unresolved
const asyncRandomBytes = (0, _util.promisify)(_crypto.randomBytes);
const rules = new _rules.default();
exports.rules = rules;
let worker = null;
let isIncompatibleEslintVersion = false;
let seenIncompatibleVersionNotification = false;
/**
 * Start the worker process if it hasn't already been started
 */

function startWorker() {
  if (worker === null) {
    worker = new _atom.Task(require.resolve('./worker.js'));
  }

  worker.on('log', obj => {
    try {
      console.log(JSON.parse(obj));
    } catch (ex) {
      console.log(obj);
    }
  });

  if (worker.started) {
    // Worker start request has already been sent
    return;
  } // Send empty arguments as we don't use them in the worker


  worker.start([]); // NOTE: Modifies the Task of the worker, but it's the only clean way to track this

  worker.started = true;
}
/**
 * Forces the worker Task to kill itself
 */


function killWorker() {
  if (worker !== null) {
    worker.terminate();
    worker = null;
  }
}

function isIncompatibleEslint() {
  return isIncompatibleEslintVersion;
}
/**
 * Send a job to the worker and return the results
 * @param  {Object} config Configuration for the job to send to the worker
 * @return {Object|String|Error}        The data returned from the worker
 */


async function sendJob(config) {
  if (worker && !worker.childProcess.connected) {
    // Sometimes the worker dies and becomes disconnected
    // When that happens, it seems that there is no way to recover other
    // than to kill the worker and create a new one.
    killWorker();
  } // Ensure the worker is started


  startWorker(); // Expand the config with a unique ID to emit on
  // NOTE: Jobs _must_ have a unique ID as they are completely async and results
  // can arrive back in any order.
  // eslint-disable-next-line no-param-reassign

  config.emitKey = (await asyncRandomBytes(5)).toString('hex'); // 5 bytes = 10 hex characters

  return new Promise((resolve, reject) => {
    // All worker errors are caught and re-emitted along with their associated
    // emitKey, so that we do not create multiple listeners for the same
    // 'task:error' event
    const errSub = worker.on(`workerError:${config.emitKey}`, ({
      msg,
      stack,
      name
    }) => {
      // Re-throw errors from the task
      const error = new Error(msg); // Set the stack to the one given to us by the worker

      error.stack = stack;
      error.name = name;
      errSub.dispose(); // eslint-disable-next-line no-use-before-define

      responseSub.dispose();
      reject(error);
    });
    const responseSub = worker.on(config.emitKey, data => {
      errSub.dispose();
      responseSub.dispose();
      resolve(data);
    }); // Send the job on to the worker

    try {
      worker.send(config);
    } catch (e) {
      errSub.dispose();
      responseSub.dispose();
      console.error(e);
    }
  });
}

async function getDebugInfo() {
  const textEditor = atom.workspace.getActiveTextEditor();
  let filePath;
  let editorScopes;

  if (atom.workspace.isTextEditor(textEditor)) {
    filePath = textEditor.getPath();
    editorScopes = textEditor.getLastCursor().getScopeDescriptor().getScopesArray();
  } else {
    // Somehow this can be called with no active TextEditor, impossible I know...
    filePath = 'unknown';
    editorScopes = ['unknown'];
  }

  const packagePath = atom.packages.resolvePackagePath('linter-eslint');
  let linterEslintMeta;

  if (packagePath === undefined) {
    // Apparently for some users the package path fails to resolve
    linterEslintMeta = {
      version: 'unknown!'
    };
  } else {
    // eslint-disable-next-line import/no-dynamic-require
    linterEslintMeta = require((0, _path.join)(packagePath, 'package.json'));
  }

  const config = atom.config.get('linter-eslint');
  const hoursSinceRestart = Math.round(process.uptime() / 3600 * 10) / 10;
  let returnVal;

  try {
    const response = await sendJob({
      type: 'debug',
      config,
      filePath
    });
    returnVal = {
      atomVersion: atom.getVersion(),
      linterEslintVersion: linterEslintMeta.version,
      linterEslintConfig: config,
      // eslint-disable-next-line import/no-dynamic-require
      eslintVersion: require((0, _path.join)(response.path, 'package.json')).version,
      hoursSinceRestart,
      platform: process.platform,
      eslintType: response.type,
      eslintPath: response.path,
      editorScopes
    };
  } catch (error) {
    atom.notifications.addError(`${error}`);
  }

  return returnVal;
}

async function generateDebugString() {
  const debug = await getDebugInfo();
  const details = [`Atom version: ${debug.atomVersion}`, `linter-eslint version: ${debug.linterEslintVersion}`, `ESLint version: ${debug.eslintVersion}`, `Hours since last Atom restart: ${debug.hoursSinceRestart}`, `Platform: ${debug.platform}`, `Using ${debug.eslintType} ESLint from: ${debug.eslintPath}`, `Current file's scopes: ${JSON.stringify(debug.editorScopes, null, 2)}`, `linter-eslint configuration: ${JSON.stringify(debug.linterEslintConfig, null, 2)}`];
  return details.join('\n');
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


function generateUserMessage(textEditor, options) {
  const {
    severity = 'error',
    excerpt = '',
    description
  } = options;
  return [{
    severity,
    excerpt,
    description,
    location: {
      file: textEditor.getPath(),
      position: (0, _atomLinter.generateRange)(textEditor)
    }
  }];
}

function isNewPackageInstalled() {
  return atom.packages.isPackageLoaded('linter-eslint-node') || atom.packages.isPackageDisabled('linter-eslint-node');
}

function showIncompatibleVersionNotification(message) {
  const notificationEnabled = atom.config.get('linter-eslint.advanced.showIncompatibleVersionNotification');

  if (!notificationEnabled || seenIncompatibleVersionNotification || isNewPackageInstalled()) {
    return;
  } // Show this message only once per session.


  seenIncompatibleVersionNotification = true;
  const notification = atom.notifications.addWarning('linter-eslint: Incompatible version', {
    description: message,
    dismissable: true,
    buttons: [{
      text: 'Install linter-eslint-node',

      onDidClick() {
        _electron.shell.openExternal('https://atom.io/packages/linter-eslint-node');

        notification.dismiss();
      }

    }, {
      text: 'Don\'t show this notification again',

      onDidClick() {
        atom.config.set('linter-eslint.advanced.showIncompatibleVersionNotification', false);
        notification.dismiss();
      }

    }]
  });
}
/**
 * Generates a message to the user in order to nicely display the Error being
 * thrown instead of depending on generic error handling.
 * @param  {import("atom").TextEditor} textEditor The TextEditor to use to build the message
 * @param  {Error} error      Error to generate a message for
 * @return {import("atom/linter").Message[]} Message to user generated from the Error
 */


function handleError(textEditor, error) {
  const {
    stack,
    message,
    name
  } = error; // We want this specific worker error to show up as a notification so that we
  // can include a button for installing the new package.

  if (name === 'IncompatibleESLintError') {
    isIncompatibleEslintVersion = true;
    killWorker();
    showIncompatibleVersionNotification(message);
    return;
  } // Only show the first line of the message as the excerpt


  const excerpt = `Error while running ESLint: ${message.split('\n')[0]}.`;
  const description = `<div style="white-space: pre-wrap">${message}\n<hr />${stack}</div>`; // eslint-disable-next-line consistent-return

  return generateUserMessage(textEditor, {
    severity: 'error',
    excerpt,
    description
  });
}

const generateInvalidTrace = async ({
  msgLine,
  msgCol,
  msgEndLine,
  msgEndCol,
  eslintFullRange,
  filePath,
  textEditor,
  ruleId,
  message
}) => {
  let errMsgRange = `${msgLine + 1}:${msgCol}`;

  if (eslintFullRange) {
    errMsgRange += ` - ${msgEndLine + 1}:${msgEndCol + 1}`;
  }

  const rangeText = `Requested ${eslintFullRange ? 'start point' : 'range'}: ${errMsgRange}`;
  const issueURL = 'https://github.com/AtomLinter/linter-eslint/issues/new';
  const titleText = `Invalid position given by '${ruleId}'`;
  const title = encodeURIComponent(titleText);
  const body = encodeURIComponent(['ESLint returned a point that did not exist in the document being edited.', `Rule: \`${ruleId}\``, rangeText, '', '', '<!-- If at all possible, please include code to reproduce this issue! -->', '', '', 'Debug information:', '```json', JSON.stringify(await getDebugInfo(), null, 2), '```'].join('\n'));
  const location = {
    file: filePath,
    position: (0, _atomLinter.generateRange)(textEditor, 0)
  };
  const newIssueURL = `${issueURL}?title=${title}&body=${body}`;
  return {
    severity: 'error',
    excerpt: `${titleText}. See the description for details. ` + 'Click the URL to open a new issue!',
    url: newIssueURL,
    location,
    description: `${rangeText}\nOriginal message: ${message}`
  };
};
/**
 * Given a raw response from ESLint, this processes the messages into a format
 * compatible with the Linter API.
 * @param  {Object}     messages   The messages from ESLint's response
 * @param  {TextEditor} textEditor The Atom::TextEditor of the file the messages belong to
 * @param  {bool}       showRule   Whether to show the rule in the messages
 * @return {Promise}               The messages transformed into Linter messages
 */


async function processESLintMessages(messages, textEditor, showRule) {
  return Promise.all(messages.map(async ({
    fatal,
    message: originalMessage,
    line,
    severity,
    ruleId,
    column,
    fix,
    endLine,
    endColumn
  }) => {
    const message = fatal ? originalMessage.split('\n')[0] : originalMessage;
    const filePath = textEditor.getPath();
    const textBuffer = textEditor.getBuffer();
    let linterFix = null;

    if (fix) {
      const fixRange = new _atom.Range(textBuffer.positionForCharacterIndex(fix.range[0]), textBuffer.positionForCharacterIndex(fix.range[1]));
      linterFix = {
        position: fixRange,
        replaceWith: fix.text
      };
    }

    let msgCol;
    let msgEndLine;
    let msgEndCol;
    let eslintFullRange = false;
    /*
     Note: ESLint positions are 1-indexed, while Atom expects 0-indexed,
     positions. We are subtracting 1 from these values here so we don't have to
     keep doing so in later uses.
     */

    const msgLine = line - 1;

    if (typeof endColumn === 'number' && typeof endLine === 'number') {
      eslintFullRange = true; // Here we always want the column to be a number

      msgCol = Math.max(0, column - 1);
      msgEndLine = endLine - 1;
      msgEndCol = endColumn - 1;
    } else {
      // We want msgCol to remain undefined if it was initially so
      // `generateRange` will give us a range over the entire line
      msgCol = typeof column === 'number' ? column - 1 : column;
    }

    let ret = {
      severity: severity === 1 ? 'warning' : 'error',
      location: {
        file: filePath
      }
    };

    if (ruleId) {
      ret.url = rules.getRuleUrl(ruleId);
    } // HACK for https://github.com/AtomLinter/linter-eslint/issues/1249


    let fixLineEnding = false;

    if (ruleId === 'prettier/prettier' && message === 'Delete `␍`') {
      fixLineEnding = true;
    }

    let range;

    try {
      if (eslintFullRange) {
        if (!fixLineEnding) {
          (0, _editor.throwIfInvalidPoint)(textBuffer, msgLine, msgCol);
          (0, _editor.throwIfInvalidPoint)(textBuffer, msgEndLine, msgEndCol);
        }

        range = [[msgLine, msgCol], [msgEndLine, msgEndCol]];
      } else {
        range = (0, _atomLinter.generateRange)(textEditor, msgLine, msgCol);
      }

      ret.location.position = range;
      const ruleAppendix = showRule ? ` (${ruleId || 'Fatal'})` : '';
      ret.excerpt = `${message}${ruleAppendix}`;

      if (linterFix) {
        ret.solutions = [linterFix];
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
        message
      });
    }

    return ret;
  }));
}
/**
 * Processes the response from the lint job
 * @param  {Object}     response   The raw response from the job
 * @param  {TextEditor} textEditor The Atom::TextEditor of the file the messages belong to
 * @param  {bool}       showRule   Whether to show the rule in the messages
 * @return {Promise}               The messages transformed into Linter messages
 */


async function processJobResponse(response, textEditor, showRule) {
  if (Object.prototype.hasOwnProperty.call(response, 'updatedRules')) {
    rules.replaceRules(response.updatedRules);
  }

  return processESLintMessages(response.messages, textEditor, showRule);
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9oZWxwZXJzLmpzIl0sIm5hbWVzIjpbImFzeW5jUmFuZG9tQnl0ZXMiLCJyYW5kb21CeXRlcyIsInJ1bGVzIiwiUnVsZXMiLCJ3b3JrZXIiLCJpc0luY29tcGF0aWJsZUVzbGludFZlcnNpb24iLCJzZWVuSW5jb21wYXRpYmxlVmVyc2lvbk5vdGlmaWNhdGlvbiIsInN0YXJ0V29ya2VyIiwiVGFzayIsInJlcXVpcmUiLCJyZXNvbHZlIiwib24iLCJvYmoiLCJjb25zb2xlIiwibG9nIiwiSlNPTiIsInBhcnNlIiwiZXgiLCJzdGFydGVkIiwic3RhcnQiLCJraWxsV29ya2VyIiwidGVybWluYXRlIiwiaXNJbmNvbXBhdGlibGVFc2xpbnQiLCJzZW5kSm9iIiwiY29uZmlnIiwiY2hpbGRQcm9jZXNzIiwiY29ubmVjdGVkIiwiZW1pdEtleSIsInRvU3RyaW5nIiwiUHJvbWlzZSIsInJlamVjdCIsImVyclN1YiIsIm1zZyIsInN0YWNrIiwibmFtZSIsImVycm9yIiwiRXJyb3IiLCJkaXNwb3NlIiwicmVzcG9uc2VTdWIiLCJkYXRhIiwic2VuZCIsImUiLCJnZXREZWJ1Z0luZm8iLCJ0ZXh0RWRpdG9yIiwiYXRvbSIsIndvcmtzcGFjZSIsImdldEFjdGl2ZVRleHRFZGl0b3IiLCJmaWxlUGF0aCIsImVkaXRvclNjb3BlcyIsImlzVGV4dEVkaXRvciIsImdldFBhdGgiLCJnZXRMYXN0Q3Vyc29yIiwiZ2V0U2NvcGVEZXNjcmlwdG9yIiwiZ2V0U2NvcGVzQXJyYXkiLCJwYWNrYWdlUGF0aCIsInBhY2thZ2VzIiwicmVzb2x2ZVBhY2thZ2VQYXRoIiwibGludGVyRXNsaW50TWV0YSIsInVuZGVmaW5lZCIsInZlcnNpb24iLCJnZXQiLCJob3Vyc1NpbmNlUmVzdGFydCIsIk1hdGgiLCJyb3VuZCIsInByb2Nlc3MiLCJ1cHRpbWUiLCJyZXR1cm5WYWwiLCJyZXNwb25zZSIsInR5cGUiLCJhdG9tVmVyc2lvbiIsImdldFZlcnNpb24iLCJsaW50ZXJFc2xpbnRWZXJzaW9uIiwibGludGVyRXNsaW50Q29uZmlnIiwiZXNsaW50VmVyc2lvbiIsInBhdGgiLCJwbGF0Zm9ybSIsImVzbGludFR5cGUiLCJlc2xpbnRQYXRoIiwibm90aWZpY2F0aW9ucyIsImFkZEVycm9yIiwiZ2VuZXJhdGVEZWJ1Z1N0cmluZyIsImRlYnVnIiwiZGV0YWlscyIsInN0cmluZ2lmeSIsImpvaW4iLCJnZW5lcmF0ZVVzZXJNZXNzYWdlIiwib3B0aW9ucyIsInNldmVyaXR5IiwiZXhjZXJwdCIsImRlc2NyaXB0aW9uIiwibG9jYXRpb24iLCJmaWxlIiwicG9zaXRpb24iLCJpc05ld1BhY2thZ2VJbnN0YWxsZWQiLCJpc1BhY2thZ2VMb2FkZWQiLCJpc1BhY2thZ2VEaXNhYmxlZCIsInNob3dJbmNvbXBhdGlibGVWZXJzaW9uTm90aWZpY2F0aW9uIiwibWVzc2FnZSIsIm5vdGlmaWNhdGlvbkVuYWJsZWQiLCJub3RpZmljYXRpb24iLCJhZGRXYXJuaW5nIiwiZGlzbWlzc2FibGUiLCJidXR0b25zIiwidGV4dCIsIm9uRGlkQ2xpY2siLCJzaGVsbCIsIm9wZW5FeHRlcm5hbCIsImRpc21pc3MiLCJzZXQiLCJoYW5kbGVFcnJvciIsInNwbGl0IiwiZ2VuZXJhdGVJbnZhbGlkVHJhY2UiLCJtc2dMaW5lIiwibXNnQ29sIiwibXNnRW5kTGluZSIsIm1zZ0VuZENvbCIsImVzbGludEZ1bGxSYW5nZSIsInJ1bGVJZCIsImVyck1zZ1JhbmdlIiwicmFuZ2VUZXh0IiwiaXNzdWVVUkwiLCJ0aXRsZVRleHQiLCJ0aXRsZSIsImVuY29kZVVSSUNvbXBvbmVudCIsImJvZHkiLCJuZXdJc3N1ZVVSTCIsInVybCIsInByb2Nlc3NFU0xpbnRNZXNzYWdlcyIsIm1lc3NhZ2VzIiwic2hvd1J1bGUiLCJhbGwiLCJtYXAiLCJmYXRhbCIsIm9yaWdpbmFsTWVzc2FnZSIsImxpbmUiLCJjb2x1bW4iLCJmaXgiLCJlbmRMaW5lIiwiZW5kQ29sdW1uIiwidGV4dEJ1ZmZlciIsImdldEJ1ZmZlciIsImxpbnRlckZpeCIsImZpeFJhbmdlIiwiUmFuZ2UiLCJwb3NpdGlvbkZvckNoYXJhY3RlckluZGV4IiwicmFuZ2UiLCJyZXBsYWNlV2l0aCIsIm1heCIsInJldCIsImdldFJ1bGVVcmwiLCJmaXhMaW5lRW5kaW5nIiwicnVsZUFwcGVuZGl4Iiwic29sdXRpb25zIiwiZXJyIiwicHJvY2Vzc0pvYlJlc3BvbnNlIiwiT2JqZWN0IiwicHJvdG90eXBlIiwiaGFzT3duUHJvcGVydHkiLCJjYWxsIiwicmVwbGFjZVJ1bGVzIiwidXBkYXRlZFJ1bGVzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7OztBQUFBOztBQUNBOztBQUNBOztBQUNBOztBQUVBOztBQUVBOztBQUNBOztBQUNBOzs7O0FBTEE7QUFFQTtBQUtBLE1BQU1BLGdCQUFnQixHQUFHLHFCQUFVQyxtQkFBVixDQUF6QjtBQUNPLE1BQU1DLEtBQUssR0FBRyxJQUFJQyxjQUFKLEVBQWQ7O0FBQ1AsSUFBSUMsTUFBTSxHQUFHLElBQWI7QUFDQSxJQUFJQywyQkFBMkIsR0FBRyxLQUFsQztBQUNBLElBQUlDLG1DQUFtQyxHQUFHLEtBQTFDO0FBRUE7QUFDQTtBQUNBOztBQUNPLFNBQVNDLFdBQVQsR0FBdUI7QUFDNUIsTUFBSUgsTUFBTSxLQUFLLElBQWYsRUFBcUI7QUFDbkJBLElBQUFBLE1BQU0sR0FBRyxJQUFJSSxVQUFKLENBQVNDLE9BQU8sQ0FBQ0MsT0FBUixDQUFnQixhQUFoQixDQUFULENBQVQ7QUFDRDs7QUFFRE4sRUFBQUEsTUFBTSxDQUFDTyxFQUFQLENBQVUsS0FBVixFQUFrQkMsR0FBRCxJQUFTO0FBQ3hCLFFBQUk7QUFDRkMsTUFBQUEsT0FBTyxDQUFDQyxHQUFSLENBQVlDLElBQUksQ0FBQ0MsS0FBTCxDQUFXSixHQUFYLENBQVo7QUFDRCxLQUZELENBRUUsT0FBT0ssRUFBUCxFQUFXO0FBQ1hKLE1BQUFBLE9BQU8sQ0FBQ0MsR0FBUixDQUFZRixHQUFaO0FBQ0Q7QUFDRixHQU5EOztBQVFBLE1BQUlSLE1BQU0sQ0FBQ2MsT0FBWCxFQUFvQjtB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SixFQUFlO0FBQ2JPLFFBQUFBLEdBQUcsQ0FBQ0ksU0FBSixHQUFnQixDQUFDWCxTQUFELENBQWhCO0FBQ0Q7QUFDRixLQWxCRCxDQWtCRSxPQUFPWSxHQUFQLEVBQVk7QUFDWkwsTUFBQUEsR0FBRyxHQUFHLE1BQU1yQyxvQkFBb0IsQ0FBQztBQUMvQkMsUUFBQUEsT0FEK0I7QUFFL0JDLFFBQUFBLE1BRitCO0FBRy9CQyxRQUFBQSxVQUgrQjtBQUkvQkMsUUFBQUEsU0FKK0I7QUFLL0JDLFFBQUFBLGVBTCtCO0FBTS9CckUsUUFBQUEsUUFOK0I7QUFPL0JKLFFBQUFBLFVBUCtCO0FBUS9CMEUsUUFBQUEsTUFSK0I7QUFTL0JwQixRQUFBQTtBQVQrQixPQUFELENBQWhDO0FBV0Q7O0FBRUQsV0FBT21ELEdBQVA7QUFDRCxHQTNGa0IsQ0FBWixDQUFQO0FBNEZEO0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUNPLGVBQWVNLGtCQUFmLENBQWtDdkYsUUFBbEMsRUFBNEN4QixVQUE1QyxFQUF3RHNGLFFBQXhELEVBQWtFO0FBQ3ZFLE1BQUkwQixNQUFNLENBQUNDLFNBQVAsQ0FBaUJDLGNBQWpCLENBQWdDQyxJQUFoQyxDQUFxQzNGLFFBQXJDLEVBQStDLGNBQS9DLENBQUosRUFBb0U7QUFDbEVqRSxJQUFBQSxLQUFLLENBQUM2SixZQUFOLENBQW1CNUYsUUFBUSxDQUFDNkYsWUFBNUI7QUFDRDs7QUFDRCxTQUFPakMscUJBQXFCLENBQUM1RCxRQUFRLENBQUM2RCxRQUFWLEVBQW9CckYsVUFBcEIsRUFBZ0NzRixRQUFoQyxDQUE1QjtBQUNEIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnXG5pbXBvcnQgeyBnZW5lcmF0ZVJhbmdlIH0gZnJvbSAnYXRvbS1saW50ZXInXG5pbXBvcnQgeyByYW5kb21CeXRlcyB9IGZyb20gJ2NyeXB0bydcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgaW1wb3J0L25vLWV4dHJhbmVvdXMtZGVwZW5kZW5jaWVzLCBpbXBvcnQvZXh0ZW5zaW9uc1xuaW1wb3J0IHsgUmFuZ2UsIFRhc2sgfSBmcm9tICdhdG9tJ1xuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGltcG9ydC9uby11bnJlc29sdmVkXG5pbXBvcnQgeyBzaGVsbCB9IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IFJ1bGVzIGZyb20gJy4vcnVsZXMnXG5pbXBvcnQgeyB0aHJvd0lmSW52YWxpZFBvaW50IH0gZnJvbSAnLi92YWxpZGF0ZS9lZGl0b3InXG5cbmNvbnN0IGFzeW5jUmFuZG9tQnl0ZXMgPSBwcm9taXNpZnkocmFuZG9tQnl0ZXMpXG5leHBvcnQgY29uc3QgcnVsZXMgPSBuZXcgUnVsZXMoKVxubGV0IHdvcmtlciA9IG51bGxcbmxldCBpc0luY29tcGF0aWJsZUVzbGludFZlcnNpb24gPSBmYWxzZVxubGV0IHNlZW5JbmNvbXBhdGlibGVWZXJzaW9uTm90aWZpY2F0aW9uID0gZmFsc2VcblxuLyoqXG4gKiBTdGFydCB0aGUgd29ya2VyIHByb2Nlc3MgaWYgaXQgaGFzbid0IGFscmVhZHkgYmVlbiBzdGFydGVkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdGFydFdvcmtlcigpIHtcbiAgaWYgKHdvcmtlciA9PT0gbnVsbCkge1xuICAgIHdvcmtlciA9IG5ldyBUYXNrKHJlcXVpcmUucmVzb2x2ZSgnLi93b3JrZXIuanMnKSlcbiAgfVxuXG4gIHdvcmtlci5vbignbG9nJywgKG9iaikgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zb2xlLmxvZyhKU09OLnBhcnNlKG9iaikpXG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIGNvbnNvbGUubG9nKG9iailcbiAgICB9XG4gIH0pXG5cbiAgaWYgKHdvcmtlci5zdGFydGVkKSB7XG4gICAgLy8gV29ya2VyIHN0YXJ0IHJlcXVlc3QgaGFzIGFscmVhZHkgYmVlbiBzZW50XG4gICAgcmV0dXJuXG4gIH1cbiAgLy8gU2VuZCBlbXB0eSBhcmd1bWVudHMgYXMgd2UgZG9uJ3QgdXNlIHRoZW0gaW4gdGhlIHdvcmtlclxuICB3b3JrZXIuc3RhcnQoW10pXG5cbiAgLy8gTk9URTogTW9kaWZpZXMgdGhlIFRhc2sgb2YgdGhlIHdvcmtlciwgYnV0IGl0J3MgdGhlIG9ubHkgY2xlYW4gd2F5IHRvIHRyYWNrIHRoaXNcbiAgd29ya2VyLnN0YXJ0ZWQgPSB0cnVlXG59XG5cbi8qKlxuICogRm9yY2VzIHRoZSB3b3JrZXIgVGFzayB0byBraWxsIGl0c2VsZlxuICovXG5leHBvcnQgZnVuY3Rpb24ga2lsbFdvcmtlcigpIHtcbiAgaWYgKHdvcmtlciAhPT0gbnVsbCkge1xuICAgIHdvcmtlci50ZXJtaW5hdGUoKVxuICAgIHdvcmtlciA9IG51bGxcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNJbmNvbXBhdGlibGVFc2xpbnQoKSB7XG4gIHJldHVybiBpc0luY29tcGF0aWJsZUVzbGludFZlcnNpb25cbn1cblxuLyoqXG4gKiBTZW5kIGEgam9iIHRvIHRoZSB3b3JrZXIgYW5kIHJldHVybiB0aGUgcmVzdWx0c1xuICogQHBhcmFtICB7T2JqZWN0fSBjb25maWcgQ29uZmlndXJhdGlvbiBmb3IgdGhlIGpvYiB0byBzZW5kIHRvIHRoZSB3b3JrZXJcbiAqIEByZXR1cm4ge09iamVjdHxTdHJpbmd8RXJyb3J9ICAgICAgICBUaGUgZGF0YSByZXR1cm5lZCBmcm9tIHRoZSB3b3JrZXJcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNlbmRKb2IoY29uZmlnKSB7XG4gIGlmICh3b3JrZXIgJiYgIXdvcmtlci5jaGlsZFByb2Nlc3MuY29ubmVjdGVkKSB7XG4gICAgLy8gU29tZXRpbWVzIHRoZSB3b3JrZXIgZGllcyBhbmQgYmVjb21lcyBkaXNjb25uZWN0ZWRcbiAgICAvLyBXaGVuIHRoYXQgaGFwcGVucywgaXQgc2VlbXMgdGhhdCB0aGVyZSBpcyBubyB3YXkgdG8gcmVjb3ZlciBvdGhlclxuICAgIC8vIHRoYW4gdG8ga2lsbCB0aGUgd29ya2VyIGFuZCBjcmVhdGUgYSBuZXcgb25lLlxuICAgIGtpbGxXb3JrZXIoKVxuICB9XG5cbiAgLy8gRW5zdXJlIHRoZSB3b3JrZXIgaXMgc3RhcnRlZFxuICBzdGFydFdvcmtlcigpXG5cbiAgLy8gRXhwYW5kIHRoZSBjb25maWcgd2l0aCBhIHVuaXF1ZSBJRCB0byBlbWl0IG9uXG4gIC8vIE5PVEU6IEpvYnMgX211c3RfIGhhdmUgYSB1bmlxdWUgSUQgYXMgdGhleSBhcmUgY29tcGxldGVseSBhc3luYyBhbmQgcmVzdWx0c1xuICAvLyBjYW4gYXJyaXZlIGJhY2sgaW4gYW55IG9yZGVyLlxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tcGFyYW0tcmVhc3NpZ25cbiAgY29uZmlnLmVtaXRLZXkgPSAoYXdhaXQgYXN5bmNSYW5kb21CeXRlcyg1KSkudG9TdHJpbmcoJ2hleCcpIC8vIDUgYnl0ZXMgPSAxMCBoZXggY2hhcmFjdGVyc1xuXG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgLy8gQWxsIHdvcmtlciBlcnJvcnMgYXJlIGNhdWdodCBhbmQgcmUtZW1pdHRlZCBhbG9uZyB3aXRoIHRoZWlyIGFzc29jaWF0ZWRcbiAgICAvLyBlbWl0S2V5LCBzbyB0aGF0IHdlIGRvIG5vdCBjcmVhdGUgbXVsdGlwbGUgbGlzdGVuZXJzIGZvciB0aGUgc2FtZVxuICAgIC8vICd0YXNrOmVycm9yJyBldmVudFxuICAgIGNvbnN0IGVyclN1YiA9IHdvcmtlci5vbihgd29ya2VyRXJyb3I6JHtjb25maWcuZW1pdEtleX1gLCAoeyBtc2csIHN0YWNrLCBuYW1lIH0pID0+IHtcbiAgICAgIC8vIFJlLXRocm93IGVycm9ycyBmcm9tIHRoZSB0YXNrXG4gICAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcihtc2cpXG4gICAgICAvLyBTZXQgdGhlIHN0YWNrIHRvIHRoZSBvbmUgZ2l2ZW4gdG8gdXMgYnkgdGhlIHdvcmtlclxuICAgICAgZXJyb3Iuc3RhY2sgPSBzdGFja1xuICAgICAgZXJyb3IubmFtZSA9IG5hbWVcbiAgICAgIGVyclN1Yi5kaXNwb3NlKClcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11c2UtYmVmb3JlLWRlZmluZVxuICAgICAgcmVzcG9uc2VTdWIuZGlzcG9zZSgpXG4gICAgICByZWplY3QoZXJyb3IpXG4gICAgfSlcbiAgICBjb25zdCByZXNwb25zZVN1YiA9IHdvcmtlci5vbihjb25maWcuZW1pdEtleSwgKGRhdGEpID0+IHtcbiAgICAgIGVyclN1Yi5kaXNwb3NlKClcbiAgICAgIHJlc3BvbnNlU3ViLmRpc3Bvc2UoKVxuICAgICAgcmVzb2x2ZShkYXRhKVxuICAgIH0pXG4gICAgLy8gU2VuZCB0aGUgam9iIG9uIHRvIHRoZSB3b3JrZXJcbiAgICB0cnkge1xuICAgICAgd29ya2VyLnNlbmQoY29uZmlnKVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGVyclN1Yi5kaXNwb3NlKClcbiAgICAgIHJlc3BvbnNlU3ViLmRpc3Bvc2UoKVxuICAgICAgY29uc29sZS5lcnJvcihlKVxuICAgIH1cbiAgfSlcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldERlYnVnSW5mbygpIHtcbiAgY29uc3QgdGV4dEVkaXRvciA9IGF0b20ud29ya3NwYWNlLmdldEFjdGl2ZVRleHRFZGl0b3IoKVxuICBsZXQgZmlsZVBhdGhcbiAgbGV0IGVkaXRvclNjb3Blc1xuICBpZiAoYXRvbS53b3Jrc3BhY2UuaXNUZXh0RWRpdG9yKHRleHRFZGl0b3IpKSB7XG4gICAgZmlsZVBhdGggPSB0ZXh0RWRpdG9yLmdldFBhdGgoKVxuICAgIGVkaXRvclNjb3BlcyA9IHRleHRFZGl0b3IuZ2V0TGFzdEN1cnNvcigpLmdldFNjb3BlRGVzY3JpcHRvcigpLmdldFNjb3Blc0FycmF5KClcbiAgfSBlbHNlIHtcbiAgICAvLyBTb21laG93IHRoaXMgY2FuIGJlIGNhbGxlZCB3aXRoIG5vIGFjdGl2ZSBUZXh0RWRpdG9yLCBpbXBvc3NpYmxlIEkga25vdy4uLlxuICAgIGZpbGVQYXRoID0gJ3Vua25vd24nXG4gICAgZWRpdG9yU2NvcGVzID0gWyd1bmtub3duJ11cbiAgfVxuICBjb25zdCBwYWNrYWdlUGF0aCA9IGF0b20ucGFja2FnZXMucmVzb2x2ZVBhY2thZ2VQYXRoKCdsaW50ZXItZXNsaW50JylcbiAgbGV0IGxpbnRlckVzbGludE1ldGFcbiAgaWYgKHBhY2thZ2VQYXRoID09PSB1bmRlZmluZWQpIHtcbiAgICAvLyBBcHBhcmVudGx5IGZvciBzb21lIHVzZXJzIHRoZSBwYWNrYWdlIHBhdGggZmFpbHMgdG8gcmVzb2x2ZVxuICAgIGxpbnRlckVzbGludE1ldGEgPSB7IHZlcnNpb246ICd1bmtub3duIScgfVxuICB9IGVsc2Uge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBpbXBvcnQvbm8tZHluYW1pYy1yZXF1aXJlXG4gICAgbGludGVyRXNsaW50TWV0YSA9IHJlcXVpcmUoam9pbihwYWNrYWdlUGF0aCwgJ3BhY2thZ2UuanNvbicpKVxuICB9XG4gIGNvbnN0IGNvbmZpZyA9IGF0b20uY29uZmlnLmdldCgnbGludGVyLWVzbGludCcpXG4gIGNvbnN0IGhvdXJzU2luY2VSZXN0YXJ0ID0gTWF0aC5yb3VuZCgocHJvY2Vzcy51cHRpbWUoKSAvIDM2MDApICogMTApIC8gMTBcbiAgbGV0IHJldHVyblZhbFxuICB0cnkge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgc2VuZEpvYih7XG4gICAgICB0eXBlOiAnZGVidWcnLFxuICAgICAgY29uZmlnLFxuICAgICAgZmlsZVBhdGhcbiAgICB9KVxuICAgIHJldHVyblZhbCA9IHtcbiAgICAgIGF0b21WZXJzaW9uOiBhdG9tLmdldFZlcnNpb24oKSxcbiAgICAgIGxpbnRlckVzbGludFZlcnNpb246IGxpbnRlckVzbGludE1ldGEudmVyc2lvbixcbiAgICAgIGxpbnRlckVzbGludENvbmZpZzogY29uZmlnLFxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGltcG9ydC9uby1keW5hbWljLXJlcXVpcmVcbiAgICAgIGVzbGludFZlcnNpb246IHJlcXVpcmUoam9pbihyZXNwb25zZS5wYXRoLCAncGFja2FnZS5qc29uJykpLnZlcnNpb24sXG4gICAgICBob3Vyc1NpbmNlUmVzdGFydCxcbiAgICAgIHBsYXRmb3JtOiBwcm9jZXNzLnBsYXRmb3JtLFxuICAgICAgZXNsaW50VHlwZTogcmVzcG9uc2UudHlwZSxcbiAgICAgIGVzbGludFBhdGg6IHJlc3BvbnNlLnBhdGgsXG4gICAgICBlZGl0b3JTY29wZXMsXG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRFcnJvcihgJHtlcnJvcn1gKVxuICB9XG4gIHJldHVybiByZXR1cm5WYWxcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlRGVidWdTdHJpbmcoKSB7XG4gIGNvbnN0IGRlYnVnID0gYXdhaXQgZ2V0RGVidWdJbmZvKClcbiAgY29uc3QgZGV0YWlscyA9IFtcbiAgICBgQXRvbSB2ZXJzaW9uOiAke2RlYnVnLmF0b21WZXJzaW9ufWAsXG4gICAgYGxpbnRlci1lc2xpbnQgdmVyc2lvbjogJHtkZWJ1Zy5saW50ZXJFc2xpbnRWZXJzaW9ufWAsXG4gICAgYEVTTGludCB2ZXJzaW9uOiAke2RlYnVnLmVzbGludFZlcnNpb259YCxcbiAgICBgSG91cnMgc2luY2UgbGFzdCBBdG9tIHJlc3RhcnQ6ICR7ZGVidWcuaG91cnNTaW5jZVJlc3RhcnR9YCxcbiAgICBgUGxhdGZvcm06ICR7ZGVidWcucGxhdGZvcm19YCxcbiAgICBgVXNpbmcgJHtkZWJ1Zy5lc2xpbnRUeXBlfSBFU0xpbnQgZnJvbTogJHtkZWJ1Zy5lc2xpbnRQYXRofWAsXG4gICAgYEN1cnJlbnQgZmlsZSdzIHNjb3BlczogJHtKU09OLnN0cmluZ2lmeShkZWJ1Zy5lZGl0b3JTY29wZXMsIG51bGwsIDIpfWAsXG4gICAgYGxpbnRlci1lc2xpbnQgY29uZmlndXJhdGlvbjogJHtKU09OLnN0cmluZ2lmeShkZWJ1Zy5saW50ZXJFc2xpbnRDb25maWcsIG51bGwsIDIpfWBcbiAgXVxuICByZXR1cm4gZGV0YWlscy5qb2luKCdcXG4nKVxufVxuXG4vKipcbiAqIFR1cm4gdGhlIGdpdmVuIG9wdGlvbnMgaW50byBhIExpbnRlciBtZXNzYWdlIGFycmF5XG4gKiBAcGFyYW0gIHtUZXh0RWRpdG9yfSB0ZXh0RWRpdG9yIFRoZSBUZXh0RWRpdG9yIHRvIHVzZSB0byBidWlsZCB0aGUgbWVzc2FnZVxuICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zICAgIFRoZSBwYXJhbWV0ZXJzIHVzZWQgdG8gZmlsbCBpbiB0aGUgbWVzc2FnZVxuICogQHBhcmFtICB7c3RyaW5nfSBbb3B0aW9ucy5zZXZlcml0eT0nZXJyb3InXSBDYW4gYmUgb25lIG9mOiAnZXJyb3InLCAnd2FybmluZycsICdpbmZvJ1xuICogQHBhcmFtICB7c3RyaW5nfSBbb3B0aW9ucy5leGNlcnB0PScnXSBTaG9ydCB0ZXh0IHRvIHVzZSBpbiB0aGUgbWVzc2FnZVxuICogQHBhcmFtICB7c3RyaW5nfEZ1bmN0aW9ufSBbb3B0aW9ucy5kZXNjcmlwdGlvbl0gVXNlZCB0byBwcm92aWRlIGFkZGl0aW9uYWwgaW5mb3JtYXRpb25cbiAqIEByZXR1cm4ge2ltcG9ydChcImF0b20vbGludGVyXCIpLk1lc3NhZ2VbXX0gTWVzc2FnZSB0byB1c2VyIGdlbmVyYXRlZCBmcm9tIHRoZSBwYXJhbWV0ZXJzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZVVzZXJNZXNzYWdlKHRleHRFZGl0b3IsIG9wdGlvbnMpIHtcbiAgY29uc3Qge1xuICAgIHNldmVyaXR5ID0gJ2Vycm9yJyxcbiAgICBleGNlcnB0ID0gJycsXG4gICAgZGVzY3JpcHRpb24sXG4gIH0gPSBvcHRpb25zXG4gIHJldHVybiBbe1xuICAgIHNldmVyaXR5LFxuICAgIGV4Y2VycHQsXG4gICAgZGVzY3JpcHRpb24sXG4gICAgbG9jYXRpb246IHtcbiAgICAgIGZpbGU6IHRleHRFZGl0b3IuZ2V0UGF0aCgpLFxuICAgICAgcG9zaXRpb246IGdlbmVyYXRlUmFuZ2UodGV4dEVkaXRvciksXG4gICAgfSxcbiAgfV1cbn1cblxuZnVuY3Rpb24gaXNOZXdQYWNrYWdlSW5zdGFsbGVkKCkge1xuICByZXR1cm4gYXRvbS5wYWNrYWdlcy5pc1BhY2thZ2VMb2FkZWQoJ2xpbnRlci1lc2xpbnQtbm9kZScpXG4gICB8fCBhdG9tLnBhY2thZ2VzLmlzUGFja2FnZURpc2FibGVkKCdsaW50ZXItZXNsaW50LW5vZGUnKVxufVxuXG5mdW5jdGlvbiBzaG93SW5jb21wYXRpYmxlVmVyc2lvbk5vdGlmaWNhdGlvbihtZXNzYWdlKSB7XG4gIGNvbnN0IG5vdGlmaWNhdGlvbkVuYWJsZWQgPSBhdG9tLmNvbmZpZy5nZXQoJ2xpbnRlci1lc2xpbnQuYWR2YW5jZWQuc2hvd0luY29tcGF0aWJsZVZlcnNpb25Ob3RpZmljYXRpb24nKVxuICBpZiAoIW5vdGlmaWNhdGlvbkVuYWJsZWQgfHwgc2VlbkluY29tcGF0aWJsZVZlcnNpb25Ob3RpZmljYXRpb24gfHwgaXNOZXdQYWNrYWdlSW5zdGFsbGVkKCkpIHtcbiAgICByZXR1cm5cbiAgfVxuXG4gIC8vIFNob3cgdGhpcyBtZXNzYWdlIG9ubHkgb25jZSBwZXIgc2Vzc2lvbi5cbiAgc2VlbkluY29tcGF0aWJsZVZlcnNpb25Ob3RpZmljYXRpb24gPSB0cnVlXG4gIGNvbnN0IG5vdGlmaWNhdGlvbiA9IGF0b20ubm90aWZpY2F0aW9ucy5hZGRXYXJuaW5nKFxuICAgICdsaW50ZXItZXNsaW50OiBJbmNvbXBhdGlibGUgdmVyc2lvbicsXG4gICAge1xuICAgICAgZGVzY3JpcHRpb246IG1lc3NhZ2UsXG4gICAgICBkaXNtaXNzYWJsZTogdHJ1ZSxcbiAgICAgIGJ1dHRvbnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHRleHQ6ICdJbnN0YWxsIGxpbnRlci1lc2xpbnQtbm9kZScsXG4gICAgICAgICAgb25EaWRDbGljaygpIHtcbiAgICAgICAgICAgIHNoZWxsLm9wZW5FeHRlcm5hbCgnaHR0cHM6Ly9hdG9tLmlvL3BhY2thZ2VzL2xpbnRlci1lc2xpbnQtbm9kZScpXG4gICAgICAgICAgICBub3RpZmljYXRpb24uZGlzbWlzcygpXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgdGV4dDogJ0RvblxcJ3Qgc2hvdyB0aGlzIG5vdGlmaWNhdGlvbiBhZ2FpbicsXG4gICAgICAgICAgb25EaWRDbGljaygpIHtcbiAgICAgICAgICAgIGF0b20uY29uZmlnLnNldCgnbGludGVyLWVzbGludC5hZHZhbmNlZC5zaG93SW5jb21wYXRpYmxlVmVyc2lvbk5vdGlmaWNhdGlvbicsIGZhbHNlKVxuICAgICAgICAgICAgbm90aWZpY2F0aW9uLmRpc21pc3MoKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgXVxuICAgIH1cbiAgKVxufVxuXG4vKipcbiAqIEdlbmVyYXRlcyBhIG1lc3NhZ2UgdG8gdGhlIHVzZXIgaW4gb3JkZXIgdG8gbmljZWx5IGRpc3BsYXkgdGhlIEVycm9yIGJlaW5nXG4gKiB0aHJvd24gaW5zdGVhZCBvZiBkZXBlbmRpbmcgb24gZ2VuZXJpYyBlcnJvciBoYW5kbGluZy5cbiAqIEBwYXJhbSAge2ltcG9ydChcImF0b21cIikuVGV4dEVkaXRvcn0gdGV4dEVkaXRvciBUaGUgVGV4dEVkaXRvciB0byB1c2UgdG8gYnVpbGQgdGhlIG1lc3NhZ2VcbiAqIEBwYXJhbSAge0Vycm9yfSBlcnJvciAgICAgIEVycm9yIHRvIGdlbmVyYXRlIGEgbWVzc2FnZSBmb3JcbiAqIEByZXR1cm4ge2ltcG9ydChcImF0b20vbGludGVyXCIpLk1lc3NhZ2VbXX0gTWVzc2FnZSB0byB1c2VyIGdlbmVyYXRlZCBmcm9tIHRoZSBFcnJvclxuICovXG5leHBvcnQgZnVuY3Rpb24gaGFuZGxlRXJyb3IodGV4dEVkaXRvciwgZXJyb3IpIHtcbiAgY29uc3QgeyBzdGFjaywgbWVzc2FnZSwgbmFtZSB9ID0gZXJyb3JcbiAgLy8gV2Ugd2FudCB0aGlzIHNwZWNpZmljIHdvcmtlciBlcnJvciB0byBzaG93IHVwIGFzIGEgbm90aWZpY2F0aW9uIHNvIHRoYXQgd2VcbiAgLy8gY2FuIGluY2x1ZGUgYSBidXR0b24gZm9yIGluc3RhbGxpbmcgdGhlIG5ldyBwYWNrYWdlLlxuICBpZiAobmFtZSA9PT0gJ0luY29tcGF0aWJsZUVTTGludEVycm9yJykge1xuICAgIGlzSW5jb21wYXRpYmxlRXNsaW50VmVyc2lvbiA9IHRydWVcbiAgICBraWxsV29ya2VyKClcbiAgICBzaG93SW5jb21wYXRpYmxlVmVyc2lvbk5vdGlmaWNhdGlvbihtZXNzYWdlKVxuICAgIHJldHVyblxuICB9XG4gIC8vIE9ubHkgc2hvdyB0aGUgZmlyc3QgbGluZSBvZiB0aGUgbWVzc2FnZSBhcyB0aGUgZXhjZXJwdFxuICBjb25zdCBleGNlcnB0ID0gYEVycm9yIHdoaWxlIHJ1bm5pbmcgRVNMaW50OiAke21lc3NhZ2Uuc3BsaXQoJ1xcbicpWzBdfS5gXG4gIGNvbnN0IGRlc2NyaXB0aW9uID0gYDxkaXYgc3R5bGU9XCJ3aGl0ZS1zcGFjZTogcHJlLXdyYXBcIj4ke21lc3NhZ2V9XFxuPGhyIC8+JHtzdGFja308L2Rpdj5gXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBjb25zaXN0ZW50LXJldHVyblxuICByZXR1cm4gZ2VuZXJhdGVVc2VyTWVzc2FnZSh0ZXh0RWRpdG9yLCB7IHNldmVyaXR5OiAnZXJyb3InLCBleGNlcnB0LCBkZXNjcmlwdGlvbiB9KVxufVxuXG5jb25zdCBnZW5lcmF0ZUludmFsaWRUcmFjZSA9IGFzeW5jICh7XG4gIG1zZ0xpbmUsIG1zZ0NvbCwgbXNnRW5kTGluZSwgbXNnRW5kQ29sLFxuICBlc2xpbnRGdWxsUmFuZ2UsIGZpbGVQYXRoLCB0ZXh0RWRpdG9yLCBydWxlSWQsIG1lc3NhZ2Vcbn0pID0+IHtcbiAgbGV0IGVyck1zZ1JhbmdlID0gYCR7bXNnTGluZSArIDF9OiR7bXNnQ29sfWBcbiAgaWYgKGVzbGludEZ1bGxSYW5nZSkge1xuICAgIGVyck1zZ1JhbmdlICs9IGAgLSAke21zZ0VuZExpbmUgKyAxfToke21zZ0VuZENvbCArIDF9YFxuICB9XG4gIGNvbnN0IHJhbmdlVGV4dCA9IGBSZXF1ZXN0ZWQgJHtlc2xpbnRGdWxsUmFuZ2UgPyAnc3RhcnQgcG9pbnQnIDogJ3JhbmdlJ306ICR7ZXJyTXNnUmFuZ2V9YFxuICBjb25zdCBpc3N1ZVVSTCA9ICdodHRwczovL2dpdGh1Yi5jb20vQXRvbUxpbnRlci9saW50ZXItZXNsaW50L2lzc3Vlcy9uZXcnXG4gIGNvbnN0IHRpdGxlVGV4dCA9IGBJbnZhbGlkIHBvc2l0aW9uIGdpdmVuIGJ5ICcke3J1bGVJZH0nYFxuICBjb25zdCB0aXRsZSA9IGVuY29kZVVSSUNvbXBvbmVudCh0aXRsZVRleHQpXG4gIGNvbnN0IGJvZHkgPSBlbmNvZGVVUklDb21wb25lbnQoW1xuICAgICdFU0xpbnQgcmV0dXJuZWQgYSBwb2ludCB0aGF0IGRpZCBub3QgZXhpc3QgaW4gdGhlIGRvY3VtZW50IGJlaW5nIGVkaXRlZC4nLFxuICAgIGBSdWxlOiBcXGAke3J1bGVJZH1cXGBgLFxuICAgIHJhbmdlVGV4dCxcbiAgICAnJywgJycsXG4gICAgJzwhLS0gSWYgYXQgYWxsIHBvc3NpYmxlLCBwbGVhc2UgaW5jbHVkZSBjb2RlIHRvIHJlcHJvZHVjZSB0aGlzIGlzc3VlISAtLT4nLFxuICAgICcnLCAnJyxcbiAgICAnRGVidWcgaW5mb3JtYXRpb246JyxcbiAgICAnYGBganNvbicsXG4gICAgSlNPTi5zdHJpbmdpZnkoYXdhaXQgZ2V0RGVidWdJbmZvKCksIG51bGwsIDIpLFxuICAgICdgYGAnXG4gIF0uam9pbignXFxuJykpXG5cbiAgY29uc3QgbG9jYXRpb24gPSB7XG4gICAgZmlsZTogZmlsZVBhdGgsXG4gICAgcG9zaXRpb246IGdlbmVyYXRlUmFuZ2UodGV4dEVkaXRvciwgMCksXG4gIH1cbiAgY29uc3QgbmV3SXNzdWVVUkwgPSBgJHtpc3N1ZVVSTH0/dGl0bGU9JHt0aXRsZX0mYm9keT0ke2JvZHl9YFxuXG4gIHJldHVybiB7XG4gICAgc2V2ZXJpdHk6ICdlcnJvcicsXG4gICAgZXhjZXJwdDogYCR7dGl0bGVUZXh0fS4gU2VlIHRoZSBkZXNjcmlwdGlvbiBmb3IgZGV0YWlscy4gYFxuICAgICAgKyAnQ2xpY2sgdGhlIFVSTCB0byBvcGVuIGEgbmV3IGlzc3VlIScsXG4gICAgdXJsOiBuZXdJc3N1ZVVSTCxcbiAgICBsb2NhdGlvbixcbiAgICBkZXNjcmlwdGlvbjogYCR7cmFuZ2VUZXh0fVxcbk9yaWdpbmFsIG1lc3NhZ2U6ICR7bWVzc2FnZX1gXG4gIH1cbn1cblxuLyoqXG4gKiBHaXZlbiBhIHJhdyByZXNwb25zZSBmcm9tIEVTTGludCwgdGhpcyBwcm9jZXNzZXMgdGhlIG1lc3NhZ2VzIGludG8gYSBmb3JtYXRcbiAqIGNvbXBhdGlibGUgd2l0aCB0aGUgTGludGVyIEFQSS5cbiAqIEBwYXJhbSAge09iamVjdH0gICAgIG1lc3NhZ2VzICAgVGhlIG1lc3NhZ2VzIGZyb20gRVNMaW50J3MgcmVzcG9uc2VcbiAqIEBwYXJhbSAge1RleHRFZGl0b3J9IHRleHRFZGl0b3IgVGhlIEF0b206OlRleHRFZGl0b3Igb2YgdGhlIGZpbGUgdGhlIG1lc3NhZ2VzIGJlbG9uZyB0b1xuICogQHBhcmFtICB7Ym9vbH0gICAgICAgc2hvd1J1bGUgICBXaGV0aGVyIHRvIHNob3cgdGhlIHJ1bGUgaW4gdGhlIG1lc3NhZ2VzXG4gKiBAcmV0dXJuIHtQcm9taXNlfSAgICAgICAgICAgICAgIFRoZSBtZXNzYWdlcyB0cmFuc2Zvcm1lZCBpbnRvIExpbnRlciBtZXNzYWdlc1xuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcHJvY2Vzc0VTTGludE1lc3NhZ2VzKG1lc3NhZ2VzLCB0ZXh0RWRpdG9yLCBzaG93UnVsZSkge1xuICByZXR1cm4gUHJvbWlzZS5hbGwobWVzc2FnZXMubWFwKGFzeW5jICh7XG4gICAgZmF0YWwsIG1lc3NhZ2U6IG9yaWdpbmFsTWVzc2FnZSwgbGluZSwgc2V2ZXJpdHksIHJ1bGVJZCwgY29sdW1uLCBmaXgsIGVuZExpbmUsIGVuZENvbHVtblxuICB9KSA9PiB7XG4gICAgY29uc3QgbWVzc2FnZSA9IGZhdGFsID8gb3JpZ2luYWxNZXNzYWdlLnNwbGl0KCdcXG4nKVswXSA6IG9yaWdpbmFsTWVzc2FnZVxuICAgIGNvbnN0IGZpbGVQYXRoID0gdGV4dEVkaXRvci5nZXRQYXRoKClcbiAgICBjb25zdCB0ZXh0QnVmZmVyID0gdGV4dEVkaXRvci5nZXRCdWZmZXIoKVxuICAgIGxldCBsaW50ZXJGaXggPSBudWxsXG4gICAgaWYgKGZpeCkge1xuICAgICAgY29uc3QgZml4UmFuZ2UgPSBuZXcgUmFuZ2UoXG4gICAgICAgIHRleHRCdWZmZXIucG9zaXRpb25Gb3JDaGFyYWN0ZXJJbmRleChmaXgucmFuZ2VbMF0pLFxuICAgICAgICB0ZXh0QnVmZmVyLnBvc2l0aW9uRm9yQ2hhcmFjdGVySW5kZXgoZml4LnJhbmdlWzFdKVxuICAgICAgKVxuICAgICAgbGludGVyRml4ID0ge1xuICAgICAgICBwb3NpdGlvbjogZml4UmFuZ2UsXG4gICAgICAgIHJlcGxhY2VXaXRoOiBmaXgudGV4dFxuICAgICAgfVxuICAgIH1cbiAgICBsZXQgbXNnQ29sXG4gICAgbGV0IG1zZ0VuZExpbmVcbiAgICBsZXQgbXNnRW5kQ29sXG4gICAgbGV0IGVzbGludEZ1bGxSYW5nZSA9IGZhbHNlXG5cbiAgICAvKlxuICAgICBOb3RlOiBFU0xpbnQgcG9zaXRpb25zIGFyZSAxLWluZGV4ZWQsIHdoaWxlIEF0b20gZXhwZWN0cyAwLWluZGV4ZWQsXG4gICAgIHBvc2l0aW9ucy4gV2UgYXJlIHN1YnRyYWN0aW5nIDEgZnJvbSB0aGVzZSB2YWx1ZXMgaGVyZSBzbyB3ZSBkb24ndCBoYXZlIHRvXG4gICAgIGtlZXAgZG9pbmcgc28gaW4gbGF0ZXIgdXNlcy5cbiAgICAgKi9cbiAgICBjb25zdCBtc2dMaW5lID0gbGluZSAtIDFcbiAgICBpZiAodHlwZW9mIGVuZENvbHVtbiA9PT0gJ251bWJlcicgJiYgdHlwZW9mIGVuZExpbmUgPT09ICdudW1iZXInKSB7XG4gICAgICBlc2xpbnRGdWxsUmFuZ2UgPSB0cnVlXG4gICAgICAvLyBIZXJlIHdlIGFsd2F5cyB3YW50IHRoZSBjb2x1bW4gdG8gYmUgYSBudW1iZXJcbiAgICAgIG1zZ0NvbCA9IE1hdGgubWF4KDAsIGNvbHVtbiAtIDEpXG4gICAgICBtc2dFbmRMaW5lID0gZW5kTGluZSAtIDFcbiAgICAgIG1zZ0VuZENvbCA9IGVuZENvbHVtbiAtIDFcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gV2Ugd2FudCBtc2dDb2wgdG8gcmVtYWluIHVuZGVmaW5lZCBpZiBpdCB3YXMgaW5pdGlhbGx5IHNvXG4gICAgICAvLyBgZ2VuZXJhdGVSYW5nZWAgd2lsbCBnaXZlIHVzIGEgcmFuZ2Ugb3ZlciB0aGUgZW50aXJlIGxpbmVcbiAgICAgIG1zZ0NvbCA9IHR5cGVvZiBjb2x1bW4gPT09ICdudW1iZXInID8gY29sdW1uIC0gMSA6IGNvbHVtblxuICAgIH1cblxuICAgIGxldCByZXQgPSB7XG4gICAgICBzZXZlcml0eTogc2V2ZXJpdHkgPT09IDEgPyAnd2FybmluZycgOiAnZXJyb3InLFxuICAgICAgbG9jYXRpb246IHtcbiAgICAgICAgZmlsZTogZmlsZVBhdGgsXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHJ1bGVJZCkge1xuICAgICAgcmV0LnVybCA9IHJ1bGVzLmdldFJ1bGVVcmwocnVsZUlkKVxuICAgIH1cblxuICAgIC8vIEhBQ0sgZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9BdG9tTGludGVyL2xpbnRlci1lc2xpbnQvaXNzdWVzLzEyNDlcbiAgICBsZXQgZml4TGluZUVuZGluZyA9IGZhbHNlXG4gICAgaWYgKHJ1bGVJZCA9PT0gJ3ByZXR0aWVyL3ByZXR0aWVyJyAmJiAobWVzc2FnZSA9PT0gJ0RlbGV0ZSBg4pCNYCcpKSB7XG4gICAgICBmaXhMaW5lRW5kaW5nID0gdHJ1ZVxuICAgIH1cblxuICAgIGxldCByYW5nZVxuICAgIHRyeSB7XG4gICAgICBpZiAoZXNsaW50RnVsbFJhbmdlKSB7XG4gICAgICAgIGlmICghZml4TGluZUVuZGluZykge1xuICAgICAgICAgIHRocm93SWZJbnZhbGlkUG9pbnQodGV4dEJ1ZmZlciwgbXNnTGluZSwgbXNnQ29sKVxuICAgICAgICAgIHRocm93SWZJbnZhbGlkUG9pbnQodGV4dEJ1ZmZlciwgbXNnRW5kTGluZSwgbXNnRW5kQ29sKVxuICAgICAgICB9XG4gICAgICAgIHJhbmdlID0gW1ttc2dMaW5lLCBtc2dDb2xdLCBbbXNnRW5kTGluZSwgbXNnRW5kQ29sXV1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJhbmdlID0gZ2VuZXJhdGVSYW5nZSh0ZXh0RWRpdG9yLCBtc2dMaW5lLCBtc2dDb2wpXG4gICAgICB9XG4gICAgICByZXQubG9jYXRpb24ucG9zaXRpb24gPSByYW5nZVxuXG4gICAgICBjb25zdCBydWxlQXBwZW5kaXggPSBzaG93UnVsZSA/IGAgKCR7cnVsZUlkIHx8ICdGYXRhbCd9KWAgOiAnJ1xuICAgICAgcmV0LmV4Y2VycHQgPSBgJHttZXNzYWdlfSR7cnVsZUFwcGVuZGl4fWBcblxuICAgICAgaWYgKGxpbnRlckZpeCkge1xuICAgICAgICByZXQuc29sdXRpb25zID0gW2xpbnRlckZpeF1cbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHJldCA9IGF3YWl0IGdlbmVyYXRlSW52YWxpZFRyYWNlKHtcbiAgICAgICAgbXNnTGluZSxcbiAgICAgICAgbXNnQ29sLFxuICAgICAgICBtc2dFbmRMaW5lLFxuICAgICAgICBtc2dFbmRDb2wsXG4gICAgICAgIGVzbGludEZ1bGxSYW5nZSxcbiAgICAgICAgZmlsZVBhdGgsXG4gICAgICAgIHRleHRFZGl0b3IsXG4gICAgICAgIHJ1bGVJZCxcbiAgICAgICAgbWVzc2FnZSxcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgcmV0dXJuIHJldFxuICB9KSlcbn1cblxuLyoqXG4gKiBQcm9jZXNzZXMgdGhlIHJlc3BvbnNlIGZyb20gdGhlIGxpbnQgam9iXG4gKiBAcGFyYW0gIHtPYmplY3R9ICAgICByZXNwb25zZSAgIFRoZSByYXcgcmVzcG9uc2UgZnJvbSB0aGUgam9iXG4gKiBAcGFyYW0gIHtUZXh0RWRpdG9yfSB0ZXh0RWRpdG9yIFRoZSBBdG9tOjpUZXh0RWRpdG9yIG9mIHRoZSBmaWxlIHRoZSBtZXNzYWdlcyBiZWxvbmcgdG9cbiAqIEBwYXJhbSAge2Jvb2x9ICAgICAgIHNob3dSdWxlICAgV2hldGhlciB0byBzaG93IHRoZSBydWxlIGluIHRoZSBtZXNzYWdlc1xuICogQHJldHVybiB7UHJvbWlzZX0gICAgICAgICAgICAgICBUaGUgbWVzc2FnZXMgdHJhbnNmb3JtZWQgaW50byBMaW50ZXIgbWVzc2FnZXNcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHByb2Nlc3NKb2JSZXNwb25zZShyZXNwb25zZSwgdGV4dEVkaXRvciwgc2hvd1J1bGUpIHtcbiAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChyZXNwb25zZSwgJ3VwZGF0ZWRSdWxlcycpKSB7XG4gICAgcnVsZXMucmVwbGFjZVJ1bGVzKHJlc3BvbnNlLnVwZGF0ZWRSdWxlcylcbiAgfVxuICByZXR1cm4gcHJvY2Vzc0VTTGludE1lc3NhZ2VzKHJlc3BvbnNlLm1lc3NhZ2VzLCB0ZXh0RWRpdG9yLCBzaG93UnVsZSlcbn1cbiJdfQ==