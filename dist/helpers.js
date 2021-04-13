"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.startWorker = startWorker;
exports.killWorker = killWorker;
exports.sendJob = sendJob;
exports.getDebugInfo = getDebugInfo;
exports.generateDebugString = generateDebugString;
exports.generateUserMessage = generateUserMessage;
exports.handleError = handleError;
exports.processESLintMessages = processESLintMessages;
exports.processJobResponse = processJobResponse;
exports.rules = void 0;

var _path = require("path");

var _atomLinter = require("atom-linter");

var _cryptoRandomString = _interopRequireDefault(require("crypto-random-string"));

var _atom = require("atom");

var _rules = _interopRequireDefault(require("./rules"));

var _editor = require("./validate/editor");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
const rules = new _rules.default();
exports.rules = rules;
let worker = null;
/**
 * Start the worker process if it hasn't already been started
 */

function startWorker() {
  if (worker === null) {
    worker = new _atom.Task(require.resolve('./worker.js'));
  }

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

  config.emitKey = (0, _cryptoRandomString.default)({
    length: 10
  });
  return new Promise((resolve, reject) => {
    // All worker errors are caught and re-emitted along with their associated
    // emitKey, so that we do not create multiple listeners for the same
    // 'task:error' event
    const errSub = worker.on(`workerError:${config.emitKey}`, ({
      msg,
      stack
    }) => {
      // Re-throw errors from the task
      const error = new Error(msg); // Set the stack to the one given to us by the worker

      error.stack = stack;
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
    message
  } = error; // Only show the first line of the message as the excerpt

  const excerpt = `Error while running ESLint: ${message.split('\n')[0]}.`;
  const description = `<div style="white-space: pre-wrap">${message}\n<hr />${stack}</div>`;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9oZWxwZXJzLmpzIl0sIm5hbWVzIjpbInJ1bGVzIiwiUnVsZXMiLCJ3b3JrZXIiLCJzdGFydFdvcmtlciIsIlRhc2siLCJyZXF1aXJlIiwicmVzb2x2ZSIsInN0YXJ0ZWQiLCJzdGFydCIsImtpbGxXb3JrZXIiLCJ0ZXJtaW5hdGUiLCJzZW5kSm9iIiwiY29uZmlnIiwiY2hpbGRQcm9jZXNzIiwiY29ubmVjdGVkIiwiZW1pdEtleSIsImxlbmd0aCIsIlByb21pc2UiLCJyZWplY3QiLCJlcnJTdWIiLCJvbiIsIm1zZyIsInN0YWNrIiwiZXJyb3IiLCJFcnJvciIsImRpc3Bvc2UiLCJyZXNwb25zZVN1YiIsImRhdGEiLCJzZW5kIiwiZSIsImNvbnNvbGUiLCJnZXREZWJ1Z0luZm8iLCJ0ZXh0RWRpdG9yIiwiYXRvbSIsIndvcmtzcGFjZSIsImdldEFjdGl2ZVRleHRFZGl0b3IiLCJmaWxlUGF0aCIsImVkaXRvclNjb3BlcyIsImlzVGV4dEVkaXRvciIsImdldFBhdGgiLCJnZXRMYXN0Q3Vyc29yIiwiZ2V0U2NvcGVEZXNjcmlwdG9yIiwiZ2V0U2NvcGVzQXJyYXkiLCJwYWNrYWdlUGF0aCIsInBhY2thZ2VzIiwicmVzb2x2ZVBhY2thZ2VQYXRoIiwibGludGVyRXNsaW50TWV0YSIsInVuZGVmaW5lZCIsInZlcnNpb24iLCJnZXQiLCJob3Vyc1NpbmNlUmVzdGFydCIsIk1hdGgiLCJyb3VuZCIsInByb2Nlc3MiLCJ1cHRpbWUiLCJyZXR1cm5WYWwiLCJyZXNwb25zZSIsInR5cGUiLCJhdG9tVmVyc2lvbiIsImdldFZlcnNpb24iLCJsaW50ZXJFc2xpbnRWZXJzaW9uIiwibGludGVyRXNsaW50Q29uZmlnIiwiZXNsaW50VmVyc2lvbiIsInBhdGgiLCJwbGF0Zm9ybSIsImVzbGludFR5cGUiLCJlc2xpbnRQYXRoIiwibm90aWZpY2F0aW9ucyIsImFkZEVycm9yIiwiZ2VuZXJhdGVEZWJ1Z1N0cmluZyIsImRlYnVnIiwiZGV0YWlscyIsIkpTT04iLCJzdHJpbmdpZnkiLCJqb2luIiwiZ2VuZXJhdGVVc2VyTWVzc2FnZSIsIm9wdGlvbnMiLCJzZXZlcml0eSIsImV4Y2VycHQiLCJkZXNjcmlwdGlvbiIsImxvY2F0aW9uIiwiZmlsZSIsInBvc2l0aW9uIiwiaGFuZGxlRXJyb3IiLCJtZXNzYWdlIiwic3BsaXQiLCJnZW5lcmF0ZUludmFsaWRUcmFjZSIsIm1zZ0xpbmUiLCJtc2dDb2wiLCJtc2dFbmRMaW5lIiwibXNnRW5kQ29sIiwiZXNsaW50RnVsbFJhbmdlIiwicnVsZUlkIiwiZXJyTXNnUmFuZ2UiLCJyYW5nZVRleHQiLCJpc3N1ZVVSTCIsInRpdGxlVGV4dCIsInRpdGxlIiwiZW5jb2RlVVJJQ29tcG9uZW50IiwiYm9keSIsIm5ld0lzc3VlVVJMIiwidXJsIiwicHJvY2Vzc0VTTGludE1lc3NhZ2VzIiwibWVzc2FnZXMiLCJzaG93UnVsZSIsImFsbCIsIm1hcCIsImZhdGFsIiwib3JpZ2luYWxNZXNzYWdlIiwibGluZSIsImNvbHVtbiIsImZpeCIsImVuZExpbmUiLCJlbmRDb2x1bW4iLCJ0ZXh0QnVmZmVyIiwiZ2V0QnVmZmVyIiwibGludGVyRml4IiwiZml4UmFuZ2UiLCJSYW5nZSIsInBvc2l0aW9uRm9yQ2hhcmFjdGVySW5kZXgiLCJyYW5nZSIsInJlcGxhY2VXaXRoIiwidGV4dCIsIm1heCIsInJldCIsImdldFJ1bGVVcmwiLCJmaXhMaW5lRW5kaW5nIiwicnVsZUFwcGVuZGl4Iiwic29sdXRpb25zIiwiZXJyIiwicHJvY2Vzc0pvYlJlc3BvbnNlIiwiT2JqZWN0IiwicHJvdG90eXBlIiwiaGFzT3duUHJvcGVydHkiLCJjYWxsIiwicmVwbGFjZVJ1bGVzIiwidXBkYXRlZFJ1bGVzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7O0FBQ0E7O0FBQ0E7O0FBRUE7O0FBQ0E7O0FBQ0E7Ozs7QUFIQTtBQUtPLE1BQU1BLEtBQUssR0FBRyxJQUFJQyxjQUFKLEVBQWQ7O0FBQ1AsSUFBSUMsTUFBTSxHQUFHLElBQWI7QUFFQTtBQUNB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LEdBQUcsR0FBRyxNQUFNdEMsb0JBQW9CLENBQUM7QUFDL0JDLFFBQUFBLE9BRCtCO0FBRS9CQyxRQUFBQSxNQUYrQjtBQUcvQkMsUUFBQUEsVUFIK0I7QUFJL0JDLFFBQUFBLFNBSitCO0FBSy9CQyxRQUFBQSxlQUwrQjtBQU0vQnZELFFBQUFBLFFBTitCO0FBTy9CSixRQUFBQSxVQVArQjtBQVEvQjRELFFBQUFBLE1BUitCO0FBUy9CUixRQUFBQTtBQVQrQixPQUFELENBQWhDO0FBV0Q7O0FBRUQsV0FBT3dDLEdBQVA7QUFDRCxHQTNGa0IsQ0FBWixDQUFQO0FBNEZEO0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUNPLGVBQWVNLGtCQUFmLENBQWtDMUUsUUFBbEMsRUFBNEN4QixVQUE1QyxFQUF3RHdFLFFBQXhELEVBQWtFO0FBQ3ZFLE1BQUkyQixNQUFNLENBQUNDLFNBQVAsQ0FBaUJDLGNBQWpCLENBQWdDQyxJQUFoQyxDQUFxQzlFLFFBQXJDLEVBQStDLGNBQS9DLENBQUosRUFBb0U7QUFDbEV4RCxJQUFBQSxLQUFLLENBQUN1SSxZQUFOLENBQW1CL0UsUUFBUSxDQUFDZ0YsWUFBNUI7QUFDRDs7QUFDRCxTQUFPbEMscUJBQXFCLENBQUM5QyxRQUFRLENBQUMrQyxRQUFWLEVBQW9CdkUsVUFBcEIsRUFBZ0N3RSxRQUFoQyxDQUE1QjtBQUNEIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnXG5pbXBvcnQgeyBnZW5lcmF0ZVJhbmdlIH0gZnJvbSAnYXRvbS1saW50ZXInXG5pbXBvcnQgY3J5cHRvUmFuZG9tU3RyaW5nIGZyb20gJ2NyeXB0by1yYW5kb20tc3RyaW5nJ1xuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGltcG9ydC9uby1leHRyYW5lb3VzLWRlcGVuZGVuY2llcywgaW1wb3J0L2V4dGVuc2lvbnNcbmltcG9ydCB7IFJhbmdlLCBUYXNrIH0gZnJvbSAnYXRvbSdcbmltcG9ydCBSdWxlcyBmcm9tICcuL3J1bGVzJ1xuaW1wb3J0IHsgdGhyb3dJZkludmFsaWRQb2ludCB9IGZyb20gJy4vdmFsaWRhdGUvZWRpdG9yJ1xuXG5leHBvcnQgY29uc3QgcnVsZXMgPSBuZXcgUnVsZXMoKVxubGV0IHdvcmtlciA9IG51bGxcblxuLyoqXG4gKiBTdGFydCB0aGUgd29ya2VyIHByb2Nlc3MgaWYgaXQgaGFzbid0IGFscmVhZHkgYmVlbiBzdGFydGVkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdGFydFdvcmtlcigpIHtcbiAgaWYgKHdvcmtlciA9PT0gbnVsbCkge1xuICAgIHdvcmtlciA9IG5ldyBUYXNrKHJlcXVpcmUucmVzb2x2ZSgnLi93b3JrZXIuanMnKSlcbiAgfVxuXG4gIGlmICh3b3JrZXIuc3RhcnRlZCkge1xuICAgIC8vIFdvcmtlciBzdGFydCByZXF1ZXN0IGhhcyBhbHJlYWR5IGJlZW4gc2VudFxuICAgIHJldHVyblxuICB9XG4gIC8vIFNlbmQgZW1wdHkgYXJndW1lbnRzIGFzIHdlIGRvbid0IHVzZSB0aGVtIGluIHRoZSB3b3JrZXJcbiAgd29ya2VyLnN0YXJ0KFtdKVxuXG4gIC8vIE5PVEU6IE1vZGlmaWVzIHRoZSBUYXNrIG9mIHRoZSB3b3JrZXIsIGJ1dCBpdCdzIHRoZSBvbmx5IGNsZWFuIHdheSB0byB0cmFjayB0aGlzXG4gIHdvcmtlci5zdGFydGVkID0gdHJ1ZVxufVxuXG4vKipcbiAqIEZvcmNlcyB0aGUgd29ya2VyIFRhc2sgdG8ga2lsbCBpdHNlbGZcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGtpbGxXb3JrZXIoKSB7XG4gIGlmICh3b3JrZXIgIT09IG51bGwpIHtcbiAgICB3b3JrZXIudGVybWluYXRlKClcbiAgICB3b3JrZXIgPSBudWxsXG4gIH1cbn1cblxuLyoqXG4gKiBTZW5kIGEgam9iIHRvIHRoZSB3b3JrZXIgYW5kIHJldHVybiB0aGUgcmVzdWx0c1xuICogQHBhcmFtICB7T2JqZWN0fSBjb25maWcgQ29uZmlndXJhdGlvbiBmb3IgdGhlIGpvYiB0byBzZW5kIHRvIHRoZSB3b3JrZXJcbiAqIEByZXR1cm4ge09iamVjdHxTdHJpbmd8RXJyb3J9ICAgICAgICBUaGUgZGF0YSByZXR1cm5lZCBmcm9tIHRoZSB3b3JrZXJcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNlbmRKb2IoY29uZmlnKSB7XG4gIGlmICh3b3JrZXIgJiYgIXdvcmtlci5jaGlsZFByb2Nlc3MuY29ubmVjdGVkKSB7XG4gICAgLy8gU29tZXRpbWVzIHRoZSB3b3JrZXIgZGllcyBhbmQgYmVjb21lcyBkaXNjb25uZWN0ZWRcbiAgICAvLyBXaGVuIHRoYXQgaGFwcGVucywgaXQgc2VlbXMgdGhhdCB0aGVyZSBpcyBubyB3YXkgdG8gcmVjb3ZlciBvdGhlclxuICAgIC8vIHRoYW4gdG8ga2lsbCB0aGUgd29ya2VyIGFuZCBjcmVhdGUgYSBuZXcgb25lLlxuICAgIGtpbGxXb3JrZXIoKVxuICB9XG5cbiAgLy8gRW5zdXJlIHRoZSB3b3JrZXIgaXMgc3RhcnRlZFxuICBzdGFydFdvcmtlcigpXG5cbiAgLy8gRXhwYW5kIHRoZSBjb25maWcgd2l0aCBhIHVuaXF1ZSBJRCB0byBlbWl0IG9uXG4gIC8vIE5PVEU6IEpvYnMgX211c3RfIGhhdmUgYSB1bmlxdWUgSUQgYXMgdGhleSBhcmUgY29tcGxldGVseSBhc3luYyBhbmQgcmVzdWx0c1xuICAvLyBjYW4gYXJyaXZlIGJhY2sgaW4gYW55IG9yZGVyLlxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tcGFyYW0tcmVhc3NpZ25cbiAgY29uZmlnLmVtaXRLZXkgPSBjcnlwdG9SYW5kb21TdHJpbmcoeyBsZW5ndGg6IDEwIH0pXG5cbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAvLyBBbGwgd29ya2VyIGVycm9ycyBhcmUgY2F1Z2h0IGFuZCByZS1lbWl0dGVkIGFsb25nIHdpdGggdGhlaXIgYXNzb2NpYXRlZFxuICAgIC8vIGVtaXRLZXksIHNvIHRoYXQgd2UgZG8gbm90IGNyZWF0ZSBtdWx0aXBsZSBsaXN0ZW5lcnMgZm9yIHRoZSBzYW1lXG4gICAgLy8gJ3Rhc2s6ZXJyb3InIGV2ZW50XG4gICAgY29uc3QgZXJyU3ViID0gd29ya2VyLm9uKGB3b3JrZXJFcnJvcjoke2NvbmZpZy5lbWl0S2V5fWAsICh7IG1zZywgc3RhY2sgfSkgPT4ge1xuICAgICAgLy8gUmUtdGhyb3cgZXJyb3JzIGZyb20gdGhlIHRhc2tcbiAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKG1zZylcbiAgICAgIC8vIFNldCB0aGUgc3RhY2sgdG8gdGhlIG9uZSBnaXZlbiB0byB1cyBieSB0aGUgd29ya2VyXG4gICAgICBlcnJvci5zdGFjayA9IHN0YWNrXG4gICAgICBlcnJTdWIuZGlzcG9zZSgpXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdXNlLWJlZm9yZS1kZWZpbmVcbiAgICAgIHJlc3BvbnNlU3ViLmRpc3Bvc2UoKVxuICAgICAgcmVqZWN0KGVycm9yKVxuICAgIH0pXG4gICAgY29uc3QgcmVzcG9uc2VTdWIgPSB3b3JrZXIub24oY29uZmlnLmVtaXRLZXksIChkYXRhKSA9PiB7XG4gICAgICBlcnJTdWIuZGlzcG9zZSgpXG4gICAgICByZXNwb25zZVN1Yi5kaXNwb3NlKClcbiAgICAgIHJlc29sdmUoZGF0YSlcbiAgICB9KVxuICAgIC8vIFNlbmQgdGhlIGpvYiBvbiB0byB0aGUgd29ya2VyXG4gICAgdHJ5IHtcbiAgICAgIHdvcmtlci5zZW5kKGNvbmZpZylcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBlcnJTdWIuZGlzcG9zZSgpXG4gICAgICByZXNwb25zZVN1Yi5kaXNwb3NlKClcbiAgICAgIGNvbnNvbGUuZXJyb3IoZSlcbiAgICB9XG4gIH0pXG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXREZWJ1Z0luZm8oKSB7XG4gIGNvbnN0IHRleHRFZGl0b3IgPSBhdG9tLndvcmtzcGFjZS5nZXRBY3RpdmVUZXh0RWRpdG9yKClcbiAgbGV0IGZpbGVQYXRoXG4gIGxldCBlZGl0b3JTY29wZXNcbiAgaWYgKGF0b20ud29ya3NwYWNlLmlzVGV4dEVkaXRvcih0ZXh0RWRpdG9yKSkge1xuICAgIGZpbGVQYXRoID0gdGV4dEVkaXRvci5nZXRQYXRoKClcbiAgICBlZGl0b3JTY29wZXMgPSB0ZXh0RWRpdG9yLmdldExhc3RDdXJzb3IoKS5nZXRTY29wZURlc2NyaXB0b3IoKS5nZXRTY29wZXNBcnJheSgpXG4gIH0gZWxzZSB7XG4gICAgLy8gU29tZWhvdyB0aGlzIGNhbiBiZSBjYWxsZWQgd2l0aCBubyBhY3RpdmUgVGV4dEVkaXRvciwgaW1wb3NzaWJsZSBJIGtub3cuLi5cbiAgICBmaWxlUGF0aCA9ICd1bmtub3duJ1xuICAgIGVkaXRvclNjb3BlcyA9IFsndW5rbm93biddXG4gIH1cbiAgY29uc3QgcGFja2FnZVBhdGggPSBhdG9tLnBhY2thZ2VzLnJlc29sdmVQYWNrYWdlUGF0aCgnbGludGVyLWVzbGludCcpXG4gIGxldCBsaW50ZXJFc2xpbnRNZXRhXG4gIGlmIChwYWNrYWdlUGF0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgLy8gQXBwYXJlbnRseSBmb3Igc29tZSB1c2VycyB0aGUgcGFja2FnZSBwYXRoIGZhaWxzIHRvIHJlc29sdmVcbiAgICBsaW50ZXJFc2xpbnRNZXRhID0geyB2ZXJzaW9uOiAndW5rbm93biEnIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgaW1wb3J0L25vLWR5bmFtaWMtcmVxdWlyZVxuICAgIGxpbnRlckVzbGludE1ldGEgPSByZXF1aXJlKGpvaW4ocGFja2FnZVBhdGgsICdwYWNrYWdlLmpzb24nKSlcbiAgfVxuICBjb25zdCBjb25maWcgPSBhdG9tLmNvbmZpZy5nZXQoJ2xpbnRlci1lc2xpbnQnKVxuICBjb25zdCBob3Vyc1NpbmNlUmVzdGFydCA9IE1hdGgucm91bmQoKHByb2Nlc3MudXB0aW1lKCkgLyAzNjAwKSAqIDEwKSAvIDEwXG4gIGxldCByZXR1cm5WYWxcbiAgdHJ5IHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHNlbmRKb2Ioe1xuICAgICAgdHlwZTogJ2RlYnVnJyxcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZpbGVQYXRoXG4gICAgfSlcbiAgICByZXR1cm5WYWwgPSB7XG4gICAgICBhdG9tVmVyc2lvbjogYXRvbS5nZXRWZXJzaW9uKCksXG4gICAgICBsaW50ZXJFc2xpbnRWZXJzaW9uOiBsaW50ZXJFc2xpbnRNZXRhLnZlcnNpb24sXG4gICAgICBsaW50ZXJFc2xpbnRDb25maWc6IGNvbmZpZyxcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBpbXBvcnQvbm8tZHluYW1pYy1yZXF1aXJlXG4gICAgICBlc2xpbnRWZXJzaW9uOiByZXF1aXJlKGpvaW4ocmVzcG9uc2UucGF0aCwgJ3BhY2thZ2UuanNvbicpKS52ZXJzaW9uLFxuICAgICAgaG91cnNTaW5jZVJlc3RhcnQsXG4gICAgICBwbGF0Zm9ybTogcHJvY2Vzcy5wbGF0Zm9ybSxcbiAgICAgIGVzbGludFR5cGU6IHJlc3BvbnNlLnR5cGUsXG4gICAgICBlc2xpbnRQYXRoOiByZXNwb25zZS5wYXRoLFxuICAgICAgZWRpdG9yU2NvcGVzLFxuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkRXJyb3IoYCR7ZXJyb3J9YClcbiAgfVxuICByZXR1cm4gcmV0dXJuVmFsXG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZW5lcmF0ZURlYnVnU3RyaW5nKCkge1xuICBjb25zdCBkZWJ1ZyA9IGF3YWl0IGdldERlYnVnSW5mbygpXG4gIGNvbnN0IGRldGFpbHMgPSBbXG4gICAgYEF0b20gdmVyc2lvbjogJHtkZWJ1Zy5hdG9tVmVyc2lvbn1gLFxuICAgIGBsaW50ZXItZXNsaW50IHZlcnNpb246ICR7ZGVidWcubGludGVyRXNsaW50VmVyc2lvbn1gLFxuICAgIGBFU0xpbnQgdmVyc2lvbjogJHtkZWJ1Zy5lc2xpbnRWZXJzaW9ufWAsXG4gICAgYEhvdXJzIHNpbmNlIGxhc3QgQXRvbSByZXN0YXJ0OiAke2RlYnVnLmhvdXJzU2luY2VSZXN0YXJ0fWAsXG4gICAgYFBsYXRmb3JtOiAke2RlYnVnLnBsYXRmb3JtfWAsXG4gICAgYFVzaW5nICR7ZGVidWcuZXNsaW50VHlwZX0gRVNMaW50IGZyb206ICR7ZGVidWcuZXNsaW50UGF0aH1gLFxuICAgIGBDdXJyZW50IGZpbGUncyBzY29wZXM6ICR7SlNPTi5zdHJpbmdpZnkoZGVidWcuZWRpdG9yU2NvcGVzLCBudWxsLCAyKX1gLFxuICAgIGBsaW50ZXItZXNsaW50IGNvbmZpZ3VyYXRpb246ICR7SlNPTi5zdHJpbmdpZnkoZGVidWcubGludGVyRXNsaW50Q29uZmlnLCBudWxsLCAyKX1gXG4gIF1cbiAgcmV0dXJuIGRldGFpbHMuam9pbignXFxuJylcbn1cblxuLyoqXG4gKiBUdXJuIHRoZSBnaXZlbiBvcHRpb25zIGludG8gYSBMaW50ZXIgbWVzc2FnZSBhcnJheVxuICogQHBhcmFtICB7VGV4dEVkaXRvcn0gdGV4dEVkaXRvciBUaGUgVGV4dEVkaXRvciB0byB1c2UgdG8gYnVpbGQgdGhlIG1lc3NhZ2VcbiAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9ucyAgICBUaGUgcGFyYW1ldGVycyB1c2VkIHRvIGZpbGwgaW4gdGhlIG1lc3NhZ2VcbiAqIEBwYXJhbSAge3N0cmluZ30gW29wdGlvbnMuc2V2ZXJpdHk9J2Vycm9yJ10gQ2FuIGJlIG9uZSBvZjogJ2Vycm9yJywgJ3dhcm5pbmcnLCAnaW5mbydcbiAqIEBwYXJhbSAge3N0cmluZ30gW29wdGlvbnMuZXhjZXJwdD0nJ10gU2hvcnQgdGV4dCB0byB1c2UgaW4gdGhlIG1lc3NhZ2VcbiAqIEBwYXJhbSAge3N0cmluZ3xGdW5jdGlvbn0gW29wdGlvbnMuZGVzY3JpcHRpb25dIFVzZWQgdG8gcHJvdmlkZSBhZGRpdGlvbmFsIGluZm9ybWF0aW9uXG4gKiBAcmV0dXJuIHtpbXBvcnQoXCJhdG9tL2xpbnRlclwiKS5NZXNzYWdlW119IE1lc3NhZ2UgdG8gdXNlciBnZW5lcmF0ZWQgZnJvbSB0aGUgcGFyYW1ldGVyc1xuICovXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVVc2VyTWVzc2FnZSh0ZXh0RWRpdG9yLCBvcHRpb25zKSB7XG4gIGNvbnN0IHtcbiAgICBzZXZlcml0eSA9ICdlcnJvcicsXG4gICAgZXhjZXJwdCA9ICcnLFxuICAgIGRlc2NyaXB0aW9uLFxuICB9ID0gb3B0aW9uc1xuICByZXR1cm4gW3tcbiAgICBzZXZlcml0eSxcbiAgICBleGNlcnB0LFxuICAgIGRlc2NyaXB0aW9uLFxuICAgIGxvY2F0aW9uOiB7XG4gICAgICBmaWxlOiB0ZXh0RWRpdG9yLmdldFBhdGgoKSxcbiAgICAgIHBvc2l0aW9uOiBnZW5lcmF0ZVJhbmdlKHRleHRFZGl0b3IpLFxuICAgIH0sXG4gIH1dXG59XG5cbi8qKlxuICogR2VuZXJhdGVzIGEgbWVzc2FnZSB0byB0aGUgdXNlciBpbiBvcmRlciB0byBuaWNlbHkgZGlzcGxheSB0aGUgRXJyb3IgYmVpbmdcbiAqIHRocm93biBpbnN0ZWFkIG9mIGRlcGVuZGluZyBvbiBnZW5lcmljIGVycm9yIGhhbmRsaW5nLlxuICogQHBhcmFtICB7aW1wb3J0KFwiYXRvbVwiKS5UZXh0RWRpdG9yfSB0ZXh0RWRpdG9yIFRoZSBUZXh0RWRpdG9yIHRvIHVzZSB0byBidWlsZCB0aGUgbWVzc2FnZVxuICogQHBhcmFtICB7RXJyb3J9IGVycm9yICAgICAgRXJyb3IgdG8gZ2VuZXJhdGUgYSBtZXNzYWdlIGZvclxuICogQHJldHVybiB7aW1wb3J0KFwiYXRvbS9saW50ZXJcIikuTWVzc2FnZVtdfSBNZXNzYWdlIHRvIHVzZXIgZ2VuZXJhdGVkIGZyb20gdGhlIEVycm9yXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoYW5kbGVFcnJvcih0ZXh0RWRpdG9yLCBlcnJvcikge1xuICBjb25zdCB7IHN0YWNrLCBtZXNzYWdlIH0gPSBlcnJvclxuICAvLyBPbmx5IHNob3cgdGhlIGZpcnN0IGxpbmUgb2YgdGhlIG1lc3NhZ2UgYXMgdGhlIGV4Y2VycHRcbiAgY29uc3QgZXhjZXJwdCA9IGBFcnJvciB3aGlsZSBydW5uaW5nIEVTTGludDogJHttZXNzYWdlLnNwbGl0KCdcXG4nKVswXX0uYFxuICBjb25zdCBkZXNjcmlwdGlvbiA9IGA8ZGl2IHN0eWxlPVwid2hpdGUtc3BhY2U6IHByZS13cmFwXCI+JHttZXNzYWdlfVxcbjxociAvPiR7c3RhY2t9PC9kaXY+YFxuICByZXR1cm4gZ2VuZXJhdGVVc2VyTWVzc2FnZSh0ZXh0RWRpdG9yLCB7IHNldmVyaXR5OiAnZXJyb3InLCBleGNlcnB0LCBkZXNjcmlwdGlvbiB9KVxufVxuXG5jb25zdCBnZW5lcmF0ZUludmFsaWRUcmFjZSA9IGFzeW5jICh7XG4gIG1zZ0xpbmUsIG1zZ0NvbCwgbXNnRW5kTGluZSwgbXNnRW5kQ29sLFxuICBlc2xpbnRGdWxsUmFuZ2UsIGZpbGVQYXRoLCB0ZXh0RWRpdG9yLCBydWxlSWQsIG1lc3NhZ2Vcbn0pID0+IHtcbiAgbGV0IGVyck1zZ1JhbmdlID0gYCR7bXNnTGluZSArIDF9OiR7bXNnQ29sfWBcbiAgaWYgKGVzbGludEZ1bGxSYW5nZSkge1xuICAgIGVyck1zZ1JhbmdlICs9IGAgLSAke21zZ0VuZExpbmUgKyAxfToke21zZ0VuZENvbCArIDF9YFxuICB9XG4gIGNvbnN0IHJhbmdlVGV4dCA9IGBSZXF1ZXN0ZWQgJHtlc2xpbnRGdWxsUmFuZ2UgPyAnc3RhcnQgcG9pbnQnIDogJ3JhbmdlJ306ICR7ZXJyTXNnUmFuZ2V9YFxuICBjb25zdCBpc3N1ZVVSTCA9ICdodHRwczovL2dpdGh1Yi5jb20vQXRvbUxpbnRlci9saW50ZXItZXNsaW50L2lzc3Vlcy9uZXcnXG4gIGNvbnN0IHRpdGxlVGV4dCA9IGBJbnZhbGlkIHBvc2l0aW9uIGdpdmVuIGJ5ICcke3J1bGVJZH0nYFxuICBjb25zdCB0aXRsZSA9IGVuY29kZVVSSUNvbXBvbmVudCh0aXRsZVRleHQpXG4gIGNvbnN0IGJvZHkgPSBlbmNvZGVVUklDb21wb25lbnQoW1xuICAgICdFU0xpbnQgcmV0dXJuZWQgYSBwb2ludCB0aGF0IGRpZCBub3QgZXhpc3QgaW4gdGhlIGRvY3VtZW50IGJlaW5nIGVkaXRlZC4nLFxuICAgIGBSdWxlOiBcXGAke3J1bGVJZH1cXGBgLFxuICAgIHJhbmdlVGV4dCxcbiAgICAnJywgJycsXG4gICAgJzwhLS0gSWYgYXQgYWxsIHBvc3NpYmxlLCBwbGVhc2UgaW5jbHVkZSBjb2RlIHRvIHJlcHJvZHVjZSB0aGlzIGlzc3VlISAtLT4nLFxuICAgICcnLCAnJyxcbiAgICAnRGVidWcgaW5mb3JtYXRpb246JyxcbiAgICAnYGBganNvbicsXG4gICAgSlNPTi5zdHJpbmdpZnkoYXdhaXQgZ2V0RGVidWdJbmZvKCksIG51bGwsIDIpLFxuICAgICdgYGAnXG4gIF0uam9pbignXFxuJykpXG5cbiAgY29uc3QgbG9jYXRpb24gPSB7XG4gICAgZmlsZTogZmlsZVBhdGgsXG4gICAgcG9zaXRpb246IGdlbmVyYXRlUmFuZ2UodGV4dEVkaXRvciwgMCksXG4gIH1cbiAgY29uc3QgbmV3SXNzdWVVUkwgPSBgJHtpc3N1ZVVSTH0/dGl0bGU9JHt0aXRsZX0mYm9keT0ke2JvZHl9YFxuXG4gIHJldHVybiB7XG4gICAgc2V2ZXJpdHk6ICdlcnJvcicsXG4gICAgZXhjZXJwdDogYCR7dGl0bGVUZXh0fS4gU2VlIHRoZSBkZXNjcmlwdGlvbiBmb3IgZGV0YWlscy4gYFxuICAgICAgKyAnQ2xpY2sgdGhlIFVSTCB0byBvcGVuIGEgbmV3IGlzc3VlIScsXG4gICAgdXJsOiBuZXdJc3N1ZVVSTCxcbiAgICBsb2NhdGlvbixcbiAgICBkZXNjcmlwdGlvbjogYCR7cmFuZ2VUZXh0fVxcbk9yaWdpbmFsIG1lc3NhZ2U6ICR7bWVzc2FnZX1gXG4gIH1cbn1cblxuLyoqXG4gKiBHaXZlbiBhIHJhdyByZXNwb25zZSBmcm9tIEVTTGludCwgdGhpcyBwcm9jZXNzZXMgdGhlIG1lc3NhZ2VzIGludG8gYSBmb3JtYXRcbiAqIGNvbXBhdGlibGUgd2l0aCB0aGUgTGludGVyIEFQSS5cbiAqIEBwYXJhbSAge09iamVjdH0gICAgIG1lc3NhZ2VzICAgVGhlIG1lc3NhZ2VzIGZyb20gRVNMaW50J3MgcmVzcG9uc2VcbiAqIEBwYXJhbSAge1RleHRFZGl0b3J9IHRleHRFZGl0b3IgVGhlIEF0b206OlRleHRFZGl0b3Igb2YgdGhlIGZpbGUgdGhlIG1lc3NhZ2VzIGJlbG9uZyB0b1xuICogQHBhcmFtICB7Ym9vbH0gICAgICAgc2hvd1J1bGUgICBXaGV0aGVyIHRvIHNob3cgdGhlIHJ1bGUgaW4gdGhlIG1lc3NhZ2VzXG4gKiBAcmV0dXJuIHtQcm9taXNlfSAgICAgICAgICAgICAgIFRoZSBtZXNzYWdlcyB0cmFuc2Zvcm1lZCBpbnRvIExpbnRlciBtZXNzYWdlc1xuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcHJvY2Vzc0VTTGludE1lc3NhZ2VzKG1lc3NhZ2VzLCB0ZXh0RWRpdG9yLCBzaG93UnVsZSkge1xuICByZXR1cm4gUHJvbWlzZS5hbGwobWVzc2FnZXMubWFwKGFzeW5jICh7XG4gICAgZmF0YWwsIG1lc3NhZ2U6IG9yaWdpbmFsTWVzc2FnZSwgbGluZSwgc2V2ZXJpdHksIHJ1bGVJZCwgY29sdW1uLCBmaXgsIGVuZExpbmUsIGVuZENvbHVtblxuICB9KSA9PiB7XG4gICAgY29uc3QgbWVzc2FnZSA9IGZhdGFsID8gb3JpZ2luYWxNZXNzYWdlLnNwbGl0KCdcXG4nKVswXSA6IG9yaWdpbmFsTWVzc2FnZVxuICAgIGNvbnN0IGZpbGVQYXRoID0gdGV4dEVkaXRvci5nZXRQYXRoKClcbiAgICBjb25zdCB0ZXh0QnVmZmVyID0gdGV4dEVkaXRvci5nZXRCdWZmZXIoKVxuICAgIGxldCBsaW50ZXJGaXggPSBudWxsXG4gICAgaWYgKGZpeCkge1xuICAgICAgY29uc3QgZml4UmFuZ2UgPSBuZXcgUmFuZ2UoXG4gICAgICAgIHRleHRCdWZmZXIucG9zaXRpb25Gb3JDaGFyYWN0ZXJJbmRleChmaXgucmFuZ2VbMF0pLFxuICAgICAgICB0ZXh0QnVmZmVyLnBvc2l0aW9uRm9yQ2hhcmFjdGVySW5kZXgoZml4LnJhbmdlWzFdKVxuICAgICAgKVxuICAgICAgbGludGVyRml4ID0ge1xuICAgICAgICBwb3NpdGlvbjogZml4UmFuZ2UsXG4gICAgICAgIHJlcGxhY2VXaXRoOiBmaXgudGV4dFxuICAgICAgfVxuICAgIH1cbiAgICBsZXQgbXNnQ29sXG4gICAgbGV0IG1zZ0VuZExpbmVcbiAgICBsZXQgbXNnRW5kQ29sXG4gICAgbGV0IGVzbGludEZ1bGxSYW5nZSA9IGZhbHNlXG5cbiAgICAvKlxuICAgICBOb3RlOiBFU0xpbnQgcG9zaXRpb25zIGFyZSAxLWluZGV4ZWQsIHdoaWxlIEF0b20gZXhwZWN0cyAwLWluZGV4ZWQsXG4gICAgIHBvc2l0aW9ucy4gV2UgYXJlIHN1YnRyYWN0aW5nIDEgZnJvbSB0aGVzZSB2YWx1ZXMgaGVyZSBzbyB3ZSBkb24ndCBoYXZlIHRvXG4gICAgIGtlZXAgZG9pbmcgc28gaW4gbGF0ZXIgdXNlcy5cbiAgICAgKi9cbiAgICBjb25zdCBtc2dMaW5lID0gbGluZSAtIDFcbiAgICBpZiAodHlwZW9mIGVuZENvbHVtbiA9PT0gJ251bWJlcicgJiYgdHlwZW9mIGVuZExpbmUgPT09ICdudW1iZXInKSB7XG4gICAgICBlc2xpbnRGdWxsUmFuZ2UgPSB0cnVlXG4gICAgICAvLyBIZXJlIHdlIGFsd2F5cyB3YW50IHRoZSBjb2x1bW4gdG8gYmUgYSBudW1iZXJcbiAgICAgIG1zZ0NvbCA9IE1hdGgubWF4KDAsIGNvbHVtbiAtIDEpXG4gICAgICBtc2dFbmRMaW5lID0gZW5kTGluZSAtIDFcbiAgICAgIG1zZ0VuZENvbCA9IGVuZENvbHVtbiAtIDFcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gV2Ugd2FudCBtc2dDb2wgdG8gcmVtYWluIHVuZGVmaW5lZCBpZiBpdCB3YXMgaW5pdGlhbGx5IHNvXG4gICAgICAvLyBgZ2VuZXJhdGVSYW5nZWAgd2lsbCBnaXZlIHVzIGEgcmFuZ2Ugb3ZlciB0aGUgZW50aXJlIGxpbmVcbiAgICAgIG1zZ0NvbCA9IHR5cGVvZiBjb2x1bW4gPT09ICdudW1iZXInID8gY29sdW1uIC0gMSA6IGNvbHVtblxuICAgIH1cblxuICAgIGxldCByZXQgPSB7XG4gICAgICBzZXZlcml0eTogc2V2ZXJpdHkgPT09IDEgPyAnd2FybmluZycgOiAnZXJyb3InLFxuICAgICAgbG9jYXRpb246IHtcbiAgICAgICAgZmlsZTogZmlsZVBhdGgsXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHJ1bGVJZCkge1xuICAgICAgcmV0LnVybCA9IHJ1bGVzLmdldFJ1bGVVcmwocnVsZUlkKVxuICAgIH1cblxuICAgIC8vIEhBQ0sgZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9BdG9tTGludGVyL2xpbnRlci1lc2xpbnQvaXNzdWVzLzEyNDlcbiAgICBsZXQgZml4TGluZUVuZGluZyA9IGZhbHNlXG4gICAgaWYgKHJ1bGVJZCA9PT0gJ3ByZXR0aWVyL3ByZXR0aWVyJyAmJiAobWVzc2FnZSA9PT0gJ0RlbGV0ZSBg4pCNYCcpKSB7XG4gICAgICBmaXhMaW5lRW5kaW5nID0gdHJ1ZVxuICAgIH1cblxuICAgIGxldCByYW5nZVxuICAgIHRyeSB7XG4gICAgICBpZiAoZXNsaW50RnVsbFJhbmdlKSB7XG4gICAgICAgIGlmICghZml4TGluZUVuZGluZykge1xuICAgICAgICAgIHRocm93SWZJbnZhbGlkUG9pbnQodGV4dEJ1ZmZlciwgbXNnTGluZSwgbXNnQ29sKVxuICAgICAgICAgIHRocm93SWZJbnZhbGlkUG9pbnQodGV4dEJ1ZmZlciwgbXNnRW5kTGluZSwgbXNnRW5kQ29sKVxuICAgICAgICB9XG4gICAgICAgIHJhbmdlID0gW1ttc2dMaW5lLCBtc2dDb2xdLCBbbXNnRW5kTGluZSwgbXNnRW5kQ29sXV1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJhbmdlID0gZ2VuZXJhdGVSYW5nZSh0ZXh0RWRpdG9yLCBtc2dMaW5lLCBtc2dDb2wpXG4gICAgICB9XG4gICAgICByZXQubG9jYXRpb24ucG9zaXRpb24gPSByYW5nZVxuXG4gICAgICBjb25zdCBydWxlQXBwZW5kaXggPSBzaG93UnVsZSA/IGAgKCR7cnVsZUlkIHx8ICdGYXRhbCd9KWAgOiAnJ1xuICAgICAgcmV0LmV4Y2VycHQgPSBgJHttZXNzYWdlfSR7cnVsZUFwcGVuZGl4fWBcblxuICAgICAgaWYgKGxpbnRlckZpeCkge1xuICAgICAgICByZXQuc29sdXRpb25zID0gW2xpbnRlckZpeF1cbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHJldCA9IGF3YWl0IGdlbmVyYXRlSW52YWxpZFRyYWNlKHtcbiAgICAgICAgbXNnTGluZSxcbiAgICAgICAgbXNnQ29sLFxuICAgICAgICBtc2dFbmRMaW5lLFxuICAgICAgICBtc2dFbmRDb2wsXG4gICAgICAgIGVzbGludEZ1bGxSYW5nZSxcbiAgICAgICAgZmlsZVBhdGgsXG4gICAgICAgIHRleHRFZGl0b3IsXG4gICAgICAgIHJ1bGVJZCxcbiAgICAgICAgbWVzc2FnZSxcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgcmV0dXJuIHJldFxuICB9KSlcbn1cblxuLyoqXG4gKiBQcm9jZXNzZXMgdGhlIHJlc3BvbnNlIGZyb20gdGhlIGxpbnQgam9iXG4gKiBAcGFyYW0gIHtPYmplY3R9ICAgICByZXNwb25zZSAgIFRoZSByYXcgcmVzcG9uc2UgZnJvbSB0aGUgam9iXG4gKiBAcGFyYW0gIHtUZXh0RWRpdG9yfSB0ZXh0RWRpdG9yIFRoZSBBdG9tOjpUZXh0RWRpdG9yIG9mIHRoZSBmaWxlIHRoZSBtZXNzYWdlcyBiZWxvbmcgdG9cbiAqIEBwYXJhbSAge2Jvb2x9ICAgICAgIHNob3dSdWxlICAgV2hldGhlciB0byBzaG93IHRoZSBydWxlIGluIHRoZSBtZXNzYWdlc1xuICogQHJldHVybiB7UHJvbWlzZX0gICAgICAgICAgICAgICBUaGUgbWVzc2FnZXMgdHJhbnNmb3JtZWQgaW50byBMaW50ZXIgbWVzc2FnZXNcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHByb2Nlc3NKb2JSZXNwb25zZShyZXNwb25zZSwgdGV4dEVkaXRvciwgc2hvd1J1bGUpIHtcbiAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChyZXNwb25zZSwgJ3VwZGF0ZWRSdWxlcycpKSB7XG4gICAgcnVsZXMucmVwbGFjZVJ1bGVzKHJlc3BvbnNlLnVwZGF0ZWRSdWxlcylcbiAgfVxuICByZXR1cm4gcHJvY2Vzc0VTTGludE1lc3NhZ2VzKHJlc3BvbnNlLm1lc3NhZ2VzLCB0ZXh0RWRpdG9yLCBzaG93UnVsZSlcbn1cbiJdfQ==