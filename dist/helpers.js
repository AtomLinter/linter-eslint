"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.generateDebugString = generateDebugString;
exports.generateUserMessage = generateUserMessage;
exports.getDebugInfo = getDebugInfo;
exports.handleError = handleError;
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

var _rules = _interopRequireDefault(require("./rules"));

var _editor = require("./validate/editor");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
const asyncRandomBytes = (0, _util.promisify)(_crypto.randomBytes);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9oZWxwZXJzLmpzIl0sIm5hbWVzIjpbImFzeW5jUmFuZG9tQnl0ZXMiLCJyYW5kb21CeXRlcyIsInJ1bGVzIiwiUnVsZXMiLCJ3b3JrZXIiLCJzdGFydFdvcmtlciIsIlRhc2siLCJyZXF1aXJlIiwicmVzb2x2ZSIsIm9uIiwib2JqIiwiY29uc29sZSIsImxvZyIsIkpTT04iLCJwYXJzZSIsImV4Iiwic3RhcnRlZCIsInN0YXJ0Iiwia2lsbFdvcmtlciIsInRlcm1pbmF0ZSIsInNlbmRKb2IiLCJjb25maWciLCJjaGlsZFByb2Nlc3MiLCJjb25uZWN0ZWQiLCJlbWl0S2V5IiwidG9TdHJpbmciLCJQcm9taXNlIiwicmVqZWN0IiwiZXJyU3ViIiwibXNnIiwic3RhY2siLCJlcnJvciIsIkVycm9yIiwiZGlzcG9zZSIsInJlc3BvbnNlU3ViIiwiZGF0YSIsInNlbmQiLCJlIiwiZ2V0RGVidWdJbmZvIiwidGV4dEVkaXRvciIsImF0b20iLCJ3b3Jrc3BhY2UiLCJnZXRBY3RpdmVUZXh0RWRpdG9yIiwiZmlsZVBhdGgiLCJlZGl0b3JTY29wZXMiLCJpc1RleHRFZGl0b3IiLCJnZXRQYXRoIiwiZ2V0TGFzdEN1cnNvciIsImdldFNjb3BlRGVzY3JpcHRvciIsImdldFNjb3Blc0FycmF5IiwicGFja2FnZVBhdGgiLCJwYWNrYWdlcyIsInJlc29sdmVQYWNrYWdlUGF0aCIsImxpbnRlckVzbGludE1ldGEiLCJ1bmRlZmluZWQiLCJ2ZXJzaW9uIiwiZ2V0IiwiaG91cnNTaW5jZVJlc3RhcnQiLCJNYXRoIiwicm91bmQiLCJwcm9jZXNzIiwidXB0aW1lIiwicmV0dXJuVmFsIiwicmVzcG9uc2UiLCJ0eXBlIiwiYXRvbVZlcnNpb24iLCJnZXRWZXJzaW9uIiwibGludGVyRXNsaW50VmVyc2lvbiIsImxpbnRlckVzbGludENvbmZpZyIsImVzbGludFZlcnNpb24iLCJwYXRoIiwicGxhdGZvcm0iLCJlc2xpbnRUeXBlIiwiZXNsaW50UGF0aCIsIm5vdGlmaWNhdGlvbnMiLCJhZGRFcnJvciIsImdlbmVyYXRlRGVidWdTdHJpbmciLCJkZWJ1ZyIsImRldGFpbHMiLCJzdHJpbmdpZnkiLCJqb2luIiwiZ2VuZXJhdGVVc2VyTWVzc2FnZSIsIm9wdGlvbnMiLCJzZXZlcml0eSIsImV4Y2VycHQiLCJkZXNjcmlwdGlvbiIsImxvY2F0aW9uIiwiZmlsZSIsInBvc2l0aW9uIiwiaGFuZGxlRXJyb3IiLCJtZXNzYWdlIiwic3BsaXQiLCJnZW5lcmF0ZUludmFsaWRUcmFjZSIsIm1zZ0xpbmUiLCJtc2dDb2wiLCJtc2dFbmRMaW5lIiwibXNnRW5kQ29sIiwiZXNsaW50RnVsbFJhbmdlIiwicnVsZUlkIiwiZXJyTXNnUmFuZ2UiLCJyYW5nZVRleHQiLCJpc3N1ZVVSTCIsInRpdGxlVGV4dCIsInRpdGxlIiwiZW5jb2RlVVJJQ29tcG9uZW50IiwiYm9keSIsIm5ld0lzc3VlVVJMIiwidXJsIiwicHJvY2Vzc0VTTGludE1lc3NhZ2VzIiwibWVzc2FnZXMiLCJzaG93UnVsZSIsImFsbCIsIm1hcCIsImZhdGFsIiwib3JpZ2luYWxNZXNzYWdlIiwibGluZSIsImNvbHVtbiIsImZpeCIsImVuZExpbmUiLCJlbmRDb2x1bW4iLCJ0ZXh0QnVmZmVyIiwiZ2V0QnVmZmVyIiwibGludGVyRml4IiwiZml4UmFuZ2UiLCJSYW5nZSIsInBvc2l0aW9uRm9yQ2hhcmFjdGVySW5kZXgiLCJyYW5nZSIsInJlcGxhY2VXaXRoIiwidGV4dCIsIm1heCIsInJldCIsImdldFJ1bGVVcmwiLCJmaXhMaW5lRW5kaW5nIiwicnVsZUFwcGVuZGl4Iiwic29sdXRpb25zIiwiZXJyIiwicHJvY2Vzc0pvYlJlc3BvbnNlIiwiT2JqZWN0IiwicHJvdG90eXBlIiwiaGFzT3duUHJvcGVydHkiLCJjYWxsIiwicmVwbGFjZVJ1bGVzIiwidXBkYXRlZFJ1bGVzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBRUE7O0FBQ0E7O0FBQ0E7Ozs7QUFIQTtBQUtBLE1B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LFNBQU9sQyxxQkFBcUIsQ0FBQzdDLFFBQVEsQ0FBQzhDLFFBQVYsRUFBb0J0RSxVQUFwQixFQUFnQ3VFLFFBQWhDLENBQTVCO0FBQ0QiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCdcbmltcG9ydCB7IGdlbmVyYXRlUmFuZ2UgfSBmcm9tICdhdG9tLWxpbnRlcidcbmltcG9ydCB7IHJhbmRvbUJ5dGVzIH0gZnJvbSAnY3J5cHRvJ1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCdcbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBpbXBvcnQvbm8tZXh0cmFuZW91cy1kZXBlbmRlbmNpZXMsIGltcG9ydC9leHRlbnNpb25zXG5pbXBvcnQgeyBSYW5nZSwgVGFzayB9IGZyb20gJ2F0b20nXG5pbXBvcnQgUnVsZXMgZnJvbSAnLi9ydWxlcydcbmltcG9ydCB7IHRocm93SWZJbnZhbGlkUG9pbnQgfSBmcm9tICcuL3ZhbGlkYXRlL2VkaXRvcidcblxuY29uc3QgYXN5bmNSYW5kb21CeXRlcyA9IHByb21pc2lmeShyYW5kb21CeXRlcylcbmV4cG9ydCBjb25zdCBydWxlcyA9IG5ldyBSdWxlcygpXG5sZXQgd29ya2VyID0gbnVsbFxuXG4vKipcbiAqIFN0YXJ0IHRoZSB3b3JrZXIgcHJvY2VzcyBpZiBpdCBoYXNuJ3QgYWxyZWFkeSBiZWVuIHN0YXJ0ZWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN0YXJ0V29ya2VyKCkge1xuICBpZiAod29ya2VyID09PSBudWxsKSB7XG4gICAgd29ya2VyID0gbmV3IFRhc2socmVxdWlyZS5yZXNvbHZlKCcuL3dvcmtlci5qcycpKVxuICB9XG5cbiAgd29ya2VyLm9uKCdsb2cnLCAob2JqKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnNvbGUubG9nKEpTT04ucGFyc2Uob2JqKSlcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgY29uc29sZS5sb2cob2JqKVxuICAgIH1cbiAgfSlcblxuICBpZiAod29ya2VyLnN0YXJ0ZWQpIHtcbiAgICAvLyBXb3JrZXIgc3RhcnQgcmVxdWVzdCBoYXMgYWxyZWFkeSBiZWVuIHNlbnRcbiAgICByZXR1cm5cbiAgfVxuICAvLyBTZW5kIGVtcHR5IGFyZ3VtZW50cyBhcyB3ZSBkb24ndCB1c2UgdGhlbSBpbiB0aGUgd29ya2VyXG4gIHdvcmtlci5zdGFydChbXSlcblxuICAvLyBOT1RFOiBNb2RpZmllcyB0aGUgVGFzayBvZiB0aGUgd29ya2VyLCBidXQgaXQncyB0aGUgb25seSBjbGVhbiB3YXkgdG8gdHJhY2sgdGhpc1xuICB3b3JrZXIuc3RhcnRlZCA9IHRydWVcbn1cblxuLyoqXG4gKiBGb3JjZXMgdGhlIHdvcmtlciBUYXNrIHRvIGtpbGwgaXRzZWxmXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBraWxsV29ya2VyKCkge1xuICBpZiAod29ya2VyICE9PSBudWxsKSB7XG4gICAgd29ya2VyLnRlcm1pbmF0ZSgpXG4gICAgd29ya2VyID0gbnVsbFxuICB9XG59XG5cbi8qKlxuICogU2VuZCBhIGpvYiB0byB0aGUgd29ya2VyIGFuZCByZXR1cm4gdGhlIHJlc3VsdHNcbiAqIEBwYXJhbSAge09iamVjdH0gY29uZmlnIENvbmZpZ3VyYXRpb24gZm9yIHRoZSBqb2IgdG8gc2VuZCB0byB0aGUgd29ya2VyXG4gKiBAcmV0dXJuIHtPYmplY3R8U3RyaW5nfEVycm9yfSAgICAgICAgVGhlIGRhdGEgcmV0dXJuZWQgZnJvbSB0aGUgd29ya2VyXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZW5kSm9iKGNvbmZpZykge1xuICBpZiAod29ya2VyICYmICF3b3JrZXIuY2hpbGRQcm9jZXNzLmNvbm5lY3RlZCkge1xuICAgIC8vIFNvbWV0aW1lcyB0aGUgd29ya2VyIGRpZXMgYW5kIGJlY29tZXMgZGlzY29ubmVjdGVkXG4gICAgLy8gV2hlbiB0aGF0IGhhcHBlbnMsIGl0IHNlZW1zIHRoYXQgdGhlcmUgaXMgbm8gd2F5IHRvIHJlY292ZXIgb3RoZXJcbiAgICAvLyB0aGFuIHRvIGtpbGwgdGhlIHdvcmtlciBhbmQgY3JlYXRlIGEgbmV3IG9uZS5cbiAgICBraWxsV29ya2VyKClcbiAgfVxuXG4gIC8vIEVuc3VyZSB0aGUgd29ya2VyIGlzIHN0YXJ0ZWRcbiAgc3RhcnRXb3JrZXIoKVxuXG4gIC8vIEV4cGFuZCB0aGUgY29uZmlnIHdpdGggYSB1bmlxdWUgSUQgdG8gZW1pdCBvblxuICAvLyBOT1RFOiBKb2JzIF9tdXN0XyBoYXZlIGEgdW5pcXVlIElEIGFzIHRoZXkgYXJlIGNvbXBsZXRlbHkgYXN5bmMgYW5kIHJlc3VsdHNcbiAgLy8gY2FuIGFycml2ZSBiYWNrIGluIGFueSBvcmRlci5cbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXBhcmFtLXJlYXNzaWduXG4gIGNvbmZpZy5lbWl0S2V5ID0gKGF3YWl0IGFzeW5jUmFuZG9tQnl0ZXMoNSkpLnRvU3RyaW5nKCdoZXgnKSAvLyA1IGJ5dGVzID0gMTAgaGV4IGNoYXJhY3RlcnNcblxuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIC8vIEFsbCB3b3JrZXIgZXJyb3JzIGFyZSBjYXVnaHQgYW5kIHJlLWVtaXR0ZWQgYWxvbmcgd2l0aCB0aGVpciBhc3NvY2lhdGVkXG4gICAgLy8gZW1pdEtleSwgc28gdGhhdCB3ZSBkbyBub3QgY3JlYXRlIG11bHRpcGxlIGxpc3RlbmVycyBmb3IgdGhlIHNhbWVcbiAgICAvLyAndGFzazplcnJvcicgZXZlbnRcbiAgICBjb25zdCBlcnJTdWIgPSB3b3JrZXIub24oYHdvcmtlckVycm9yOiR7Y29uZmlnLmVtaXRLZXl9YCwgKHsgbXNnLCBzdGFjayB9KSA9PiB7XG4gICAgICAvLyBSZS10aHJvdyBlcnJvcnMgZnJvbSB0aGUgdGFza1xuICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IobXNnKVxuICAgICAgLy8gU2V0IHRoZSBzdGFjayB0byB0aGUgb25lIGdpdmVuIHRvIHVzIGJ5IHRoZSB3b3JrZXJcbiAgICAgIGVycm9yLnN0YWNrID0gc3RhY2tcbiAgICAgIGVyclN1Yi5kaXNwb3NlKClcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11c2UtYmVmb3JlLWRlZmluZVxuICAgICAgcmVzcG9uc2VTdWIuZGlzcG9zZSgpXG4gICAgICByZWplY3QoZXJyb3IpXG4gICAgfSlcbiAgICBjb25zdCByZXNwb25zZVN1YiA9IHdvcmtlci5vbihjb25maWcuZW1pdEtleSwgKGRhdGEpID0+IHtcbiAgICAgIGVyclN1Yi5kaXNwb3NlKClcbiAgICAgIHJlc3BvbnNlU3ViLmRpc3Bvc2UoKVxuICAgICAgcmVzb2x2ZShkYXRhKVxuICAgIH0pXG4gICAgLy8gU2VuZCB0aGUgam9iIG9uIHRvIHRoZSB3b3JrZXJcbiAgICB0cnkge1xuICAgICAgd29ya2VyLnNlbmQoY29uZmlnKVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGVyclN1Yi5kaXNwb3NlKClcbiAgICAgIHJlc3BvbnNlU3ViLmRpc3Bvc2UoKVxuICAgICAgY29uc29sZS5lcnJvcihlKVxuICAgIH1cbiAgfSlcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldERlYnVnSW5mbygpIHtcbiAgY29uc3QgdGV4dEVkaXRvciA9IGF0b20ud29ya3NwYWNlLmdldEFjdGl2ZVRleHRFZGl0b3IoKVxuICBsZXQgZmlsZVBhdGhcbiAgbGV0IGVkaXRvclNjb3Blc1xuICBpZiAoYXRvbS53b3Jrc3BhY2UuaXNUZXh0RWRpdG9yKHRleHRFZGl0b3IpKSB7XG4gICAgZmlsZVBhdGggPSB0ZXh0RWRpdG9yLmdldFBhdGgoKVxuICAgIGVkaXRvclNjb3BlcyA9IHRleHRFZGl0b3IuZ2V0TGFzdEN1cnNvcigpLmdldFNjb3BlRGVzY3JpcHRvcigpLmdldFNjb3Blc0FycmF5KClcbiAgfSBlbHNlIHtcbiAgICAvLyBTb21laG93IHRoaXMgY2FuIGJlIGNhbGxlZCB3aXRoIG5vIGFjdGl2ZSBUZXh0RWRpdG9yLCBpbXBvc3NpYmxlIEkga25vdy4uLlxuICAgIGZpbGVQYXRoID0gJ3Vua25vd24nXG4gICAgZWRpdG9yU2NvcGVzID0gWyd1bmtub3duJ11cbiAgfVxuICBjb25zdCBwYWNrYWdlUGF0aCA9IGF0b20ucGFja2FnZXMucmVzb2x2ZVBhY2thZ2VQYXRoKCdsaW50ZXItZXNsaW50JylcbiAgbGV0IGxpbnRlckVzbGludE1ldGFcbiAgaWYgKHBhY2thZ2VQYXRoID09PSB1bmRlZmluZWQpIHtcbiAgICAvLyBBcHBhcmVudGx5IGZvciBzb21lIHVzZXJzIHRoZSBwYWNrYWdlIHBhdGggZmFpbHMgdG8gcmVzb2x2ZVxuICAgIGxpbnRlckVzbGludE1ldGEgPSB7IHZlcnNpb246ICd1bmtub3duIScgfVxuICB9IGVsc2Uge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBpbXBvcnQvbm8tZHluYW1pYy1yZXF1aXJlXG4gICAgbGludGVyRXNsaW50TWV0YSA9IHJlcXVpcmUoam9pbihwYWNrYWdlUGF0aCwgJ3BhY2thZ2UuanNvbicpKVxuICB9XG4gIGNvbnN0IGNvbmZpZyA9IGF0b20uY29uZmlnLmdldCgnbGludGVyLWVzbGludCcpXG4gIGNvbnN0IGhvdXJzU2luY2VSZXN0YXJ0ID0gTWF0aC5yb3VuZCgocHJvY2Vzcy51cHRpbWUoKSAvIDM2MDApICogMTApIC8gMTBcbiAgbGV0IHJldHVyblZhbFxuICB0cnkge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgc2VuZEpvYih7XG4gICAgICB0eXBlOiAnZGVidWcnLFxuICAgICAgY29uZmlnLFxuICAgICAgZmlsZVBhdGhcbiAgICB9KVxuICAgIHJldHVyblZhbCA9IHtcbiAgICAgIGF0b21WZXJzaW9uOiBhdG9tLmdldFZlcnNpb24oKSxcbiAgICAgIGxpbnRlckVzbGludFZlcnNpb246IGxpbnRlckVzbGludE1ldGEudmVyc2lvbixcbiAgICAgIGxpbnRlckVzbGludENvbmZpZzogY29uZmlnLFxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGltcG9ydC9uby1keW5hbWljLXJlcXVpcmVcbiAgICAgIGVzbGludFZlcnNpb246IHJlcXVpcmUoam9pbihyZXNwb25zZS5wYXRoLCAncGFja2FnZS5qc29uJykpLnZlcnNpb24sXG4gICAgICBob3Vyc1NpbmNlUmVzdGFydCxcbiAgICAgIHBsYXRmb3JtOiBwcm9jZXNzLnBsYXRmb3JtLFxuICAgICAgZXNsaW50VHlwZTogcmVzcG9uc2UudHlwZSxcbiAgICAgIGVzbGludFBhdGg6IHJlc3BvbnNlLnBhdGgsXG4gICAgICBlZGl0b3JTY29wZXMsXG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRFcnJvcihgJHtlcnJvcn1gKVxuICB9XG4gIHJldHVybiByZXR1cm5WYWxcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlRGVidWdTdHJpbmcoKSB7XG4gIGNvbnN0IGRlYnVnID0gYXdhaXQgZ2V0RGVidWdJbmZvKClcbiAgY29uc3QgZGV0YWlscyA9IFtcbiAgICBgQXRvbSB2ZXJzaW9uOiAke2RlYnVnLmF0b21WZXJzaW9ufWAsXG4gICAgYGxpbnRlci1lc2xpbnQgdmVyc2lvbjogJHtkZWJ1Zy5saW50ZXJFc2xpbnRWZXJzaW9ufWAsXG4gICAgYEVTTGludCB2ZXJzaW9uOiAke2RlYnVnLmVzbGludFZlcnNpb259YCxcbiAgICBgSG91cnMgc2luY2UgbGFzdCBBdG9tIHJlc3RhcnQ6ICR7ZGVidWcuaG91cnNTaW5jZVJlc3RhcnR9YCxcbiAgICBgUGxhdGZvcm06ICR7ZGVidWcucGxhdGZvcm19YCxcbiAgICBgVXNpbmcgJHtkZWJ1Zy5lc2xpbnRUeXBlfSBFU0xpbnQgZnJvbTogJHtkZWJ1Zy5lc2xpbnRQYXRofWAsXG4gICAgYEN1cnJlbnQgZmlsZSdzIHNjb3BlczogJHtKU09OLnN0cmluZ2lmeShkZWJ1Zy5lZGl0b3JTY29wZXMsIG51bGwsIDIpfWAsXG4gICAgYGxpbnRlci1lc2xpbnQgY29uZmlndXJhdGlvbjogJHtKU09OLnN0cmluZ2lmeShkZWJ1Zy5saW50ZXJFc2xpbnRDb25maWcsIG51bGwsIDIpfWBcbiAgXVxuICByZXR1cm4gZGV0YWlscy5qb2luKCdcXG4nKVxufVxuXG4vKipcbiAqIFR1cm4gdGhlIGdpdmVuIG9wdGlvbnMgaW50byBhIExpbnRlciBtZXNzYWdlIGFycmF5XG4gKiBAcGFyYW0gIHtUZXh0RWRpdG9yfSB0ZXh0RWRpdG9yIFRoZSBUZXh0RWRpdG9yIHRvIHVzZSB0byBidWlsZCB0aGUgbWVzc2FnZVxuICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zICAgIFRoZSBwYXJhbWV0ZXJzIHVzZWQgdG8gZmlsbCBpbiB0aGUgbWVzc2FnZVxuICogQHBhcmFtICB7c3RyaW5nfSBbb3B0aW9ucy5zZXZlcml0eT0nZXJyb3InXSBDYW4gYmUgb25lIG9mOiAnZXJyb3InLCAnd2FybmluZycsICdpbmZvJ1xuICogQHBhcmFtICB7c3RyaW5nfSBbb3B0aW9ucy5leGNlcnB0PScnXSBTaG9ydCB0ZXh0IHRvIHVzZSBpbiB0aGUgbWVzc2FnZVxuICogQHBhcmFtICB7c3RyaW5nfEZ1bmN0aW9ufSBbb3B0aW9ucy5kZXNjcmlwdGlvbl0gVXNlZCB0byBwcm92aWRlIGFkZGl0aW9uYWwgaW5mb3JtYXRpb25cbiAqIEByZXR1cm4ge2ltcG9ydChcImF0b20vbGludGVyXCIpLk1lc3NhZ2VbXX0gTWVzc2FnZSB0byB1c2VyIGdlbmVyYXRlZCBmcm9tIHRoZSBwYXJhbWV0ZXJzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZVVzZXJNZXNzYWdlKHRleHRFZGl0b3IsIG9wdGlvbnMpIHtcbiAgY29uc3Qge1xuICAgIHNldmVyaXR5ID0gJ2Vycm9yJyxcbiAgICBleGNlcnB0ID0gJycsXG4gICAgZGVzY3JpcHRpb24sXG4gIH0gPSBvcHRpb25zXG4gIHJldHVybiBbe1xuICAgIHNldmVyaXR5LFxuICAgIGV4Y2VycHQsXG4gICAgZGVzY3JpcHRpb24sXG4gICAgbG9jYXRpb246IHtcbiAgICAgIGZpbGU6IHRleHRFZGl0b3IuZ2V0UGF0aCgpLFxuICAgICAgcG9zaXRpb246IGdlbmVyYXRlUmFuZ2UodGV4dEVkaXRvciksXG4gICAgfSxcbiAgfV1cbn1cblxuLyoqXG4gKiBHZW5lcmF0ZXMgYSBtZXNzYWdlIHRvIHRoZSB1c2VyIGluIG9yZGVyIHRvIG5pY2VseSBkaXNwbGF5IHRoZSBFcnJvciBiZWluZ1xuICogdGhyb3duIGluc3RlYWQgb2YgZGVwZW5kaW5nIG9uIGdlbmVyaWMgZXJyb3IgaGFuZGxpbmcuXG4gKiBAcGFyYW0gIHtpbXBvcnQoXCJhdG9tXCIpLlRleHRFZGl0b3J9IHRleHRFZGl0b3IgVGhlIFRleHRFZGl0b3IgdG8gdXNlIHRvIGJ1aWxkIHRoZSBtZXNzYWdlXG4gKiBAcGFyYW0gIHtFcnJvcn0gZXJyb3IgICAgICBFcnJvciB0byBnZW5lcmF0ZSBhIG1lc3NhZ2UgZm9yXG4gKiBAcmV0dXJuIHtpbXBvcnQoXCJhdG9tL2xpbnRlclwiKS5NZXNzYWdlW119IE1lc3NhZ2UgdG8gdXNlciBnZW5lcmF0ZWQgZnJvbSB0aGUgRXJyb3JcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhhbmRsZUVycm9yKHRleHRFZGl0b3IsIGVycm9yKSB7XG4gIGNvbnN0IHsgc3RhY2ssIG1lc3NhZ2UgfSA9IGVycm9yXG4gIC8vIE9ubHkgc2hvdyB0aGUgZmlyc3QgbGluZSBvZiB0aGUgbWVzc2FnZSBhcyB0aGUgZXhjZXJwdFxuICBjb25zdCBleGNlcnB0ID0gYEVycm9yIHdoaWxlIHJ1bm5pbmcgRVNMaW50OiAke21lc3NhZ2Uuc3BsaXQoJ1xcbicpWzBdfS5gXG4gIGNvbnN0IGRlc2NyaXB0aW9uID0gYDxkaXYgc3R5bGU9XCJ3aGl0ZS1zcGFjZTogcHJlLXdyYXBcIj4ke21lc3NhZ2V9XFxuPGhyIC8+JHtzdGFja308L2Rpdj5gXG4gIHJldHVybiBnZW5lcmF0ZVVzZXJNZXNzYWdlKHRleHRFZGl0b3IsIHsgc2V2ZXJpdHk6ICdlcnJvcicsIGV4Y2VycHQsIGRlc2NyaXB0aW9uIH0pXG59XG5cbmNvbnN0IGdlbmVyYXRlSW52YWxpZFRyYWNlID0gYXN5bmMgKHtcbiAgbXNnTGluZSwgbXNnQ29sLCBtc2dFbmRMaW5lLCBtc2dFbmRDb2wsXG4gIGVzbGludEZ1bGxSYW5nZSwgZmlsZVBhdGgsIHRleHRFZGl0b3IsIHJ1bGVJZCwgbWVzc2FnZVxufSkgPT4ge1xuICBsZXQgZXJyTXNnUmFuZ2UgPSBgJHttc2dMaW5lICsgMX06JHttc2dDb2x9YFxuICBpZiAoZXNsaW50RnVsbFJhbmdlKSB7XG4gICAgZXJyTXNnUmFuZ2UgKz0gYCAtICR7bXNnRW5kTGluZSArIDF9OiR7bXNnRW5kQ29sICsgMX1gXG4gIH1cbiAgY29uc3QgcmFuZ2VUZXh0ID0gYFJlcXVlc3RlZCAke2VzbGludEZ1bGxSYW5nZSA/ICdzdGFydCBwb2ludCcgOiAncmFuZ2UnfTogJHtlcnJNc2dSYW5nZX1gXG4gIGNvbnN0IGlzc3VlVVJMID0gJ2h0dHBzOi8vZ2l0aHViLmNvbS9BdG9tTGludGVyL2xpbnRlci1lc2xpbnQvaXNzdWVzL25ldydcbiAgY29uc3QgdGl0bGVUZXh0ID0gYEludmFsaWQgcG9zaXRpb24gZ2l2ZW4gYnkgJyR7cnVsZUlkfSdgXG4gIGNvbnN0IHRpdGxlID0gZW5jb2RlVVJJQ29tcG9uZW50KHRpdGxlVGV4dClcbiAgY29uc3QgYm9keSA9IGVuY29kZVVSSUNvbXBvbmVudChbXG4gICAgJ0VTTGludCByZXR1cm5lZCBhIHBvaW50IHRoYXQgZGlkIG5vdCBleGlzdCBpbiB0aGUgZG9jdW1lbnQgYmVpbmcgZWRpdGVkLicsXG4gICAgYFJ1bGU6IFxcYCR7cnVsZUlkfVxcYGAsXG4gICAgcmFuZ2VUZXh0LFxuICAgICcnLCAnJyxcbiAgICAnPCEtLSBJZiBhdCBhbGwgcG9zc2libGUsIHBsZWFzZSBpbmNsdWRlIGNvZGUgdG8gcmVwcm9kdWNlIHRoaXMgaXNzdWUhIC0tPicsXG4gICAgJycsICcnLFxuICAgICdEZWJ1ZyBpbmZvcm1hdGlvbjonLFxuICAgICdgYGBqc29uJyxcbiAgICBKU09OLnN0cmluZ2lmeShhd2FpdCBnZXREZWJ1Z0luZm8oKSwgbnVsbCwgMiksXG4gICAgJ2BgYCdcbiAgXS5qb2luKCdcXG4nKSlcblxuICBjb25zdCBsb2NhdGlvbiA9IHtcbiAgICBmaWxlOiBmaWxlUGF0aCxcbiAgICBwb3NpdGlvbjogZ2VuZXJhdGVSYW5nZSh0ZXh0RWRpdG9yLCAwKSxcbiAgfVxuICBjb25zdCBuZXdJc3N1ZVVSTCA9IGAke2lzc3VlVVJMfT90aXRsZT0ke3RpdGxlfSZib2R5PSR7Ym9keX1gXG5cbiAgcmV0dXJuIHtcbiAgICBzZXZlcml0eTogJ2Vycm9yJyxcbiAgICBleGNlcnB0OiBgJHt0aXRsZVRleHR9LiBTZWUgdGhlIGRlc2NyaXB0aW9uIGZvciBkZXRhaWxzLiBgXG4gICAgICArICdDbGljayB0aGUgVVJMIHRvIG9wZW4gYSBuZXcgaXNzdWUhJyxcbiAgICB1cmw6IG5ld0lzc3VlVVJMLFxuICAgIGxvY2F0aW9uLFxuICAgIGRlc2NyaXB0aW9uOiBgJHtyYW5nZVRleHR9XFxuT3JpZ2luYWwgbWVzc2FnZTogJHttZXNzYWdlfWBcbiAgfVxufVxuXG4vKipcbiAqIEdpdmVuIGEgcmF3IHJlc3BvbnNlIGZyb20gRVNMaW50LCB0aGlzIHByb2Nlc3NlcyB0aGUgbWVzc2FnZXMgaW50byBhIGZvcm1hdFxuICogY29tcGF0aWJsZSB3aXRoIHRoZSBMaW50ZXIgQVBJLlxuICogQHBhcmFtICB7T2JqZWN0fSAgICAgbWVzc2FnZXMgICBUaGUgbWVzc2FnZXMgZnJvbSBFU0xpbnQncyByZXNwb25zZVxuICogQHBhcmFtICB7VGV4dEVkaXRvcn0gdGV4dEVkaXRvciBUaGUgQXRvbTo6VGV4dEVkaXRvciBvZiB0aGUgZmlsZSB0aGUgbWVzc2FnZXMgYmVsb25nIHRvXG4gKiBAcGFyYW0gIHtib29sfSAgICAgICBzaG93UnVsZSAgIFdoZXRoZXIgdG8gc2hvdyB0aGUgcnVsZSBpbiB0aGUgbWVzc2FnZXNcbiAqIEByZXR1cm4ge1Byb21pc2V9ICAgICAgICAgICAgICAgVGhlIG1lc3NhZ2VzIHRyYW5zZm9ybWVkIGludG8gTGludGVyIG1lc3NhZ2VzXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwcm9jZXNzRVNMaW50TWVzc2FnZXMobWVzc2FnZXMsIHRleHRFZGl0b3IsIHNob3dSdWxlKSB7XG4gIHJldHVybiBQcm9taXNlLmFsbChtZXNzYWdlcy5tYXAoYXN5bmMgKHtcbiAgICBmYXRhbCwgbWVzc2FnZTogb3JpZ2luYWxNZXNzYWdlLCBsaW5lLCBzZXZlcml0eSwgcnVsZUlkLCBjb2x1bW4sIGZpeCwgZW5kTGluZSwgZW5kQ29sdW1uXG4gIH0pID0+IHtcbiAgICBjb25zdCBtZXNzYWdlID0gZmF0YWwgPyBvcmlnaW5hbE1lc3NhZ2Uuc3BsaXQoJ1xcbicpWzBdIDogb3JpZ2luYWxNZXNzYWdlXG4gICAgY29uc3QgZmlsZVBhdGggPSB0ZXh0RWRpdG9yLmdldFBhdGgoKVxuICAgIGNvbnN0IHRleHRCdWZmZXIgPSB0ZXh0RWRpdG9yLmdldEJ1ZmZlcigpXG4gICAgbGV0IGxpbnRlckZpeCA9IG51bGxcbiAgICBpZiAoZml4KSB7XG4gICAgICBjb25zdCBmaXhSYW5nZSA9IG5ldyBSYW5nZShcbiAgICAgICAgdGV4dEJ1ZmZlci5wb3NpdGlvbkZvckNoYXJhY3RlckluZGV4KGZpeC5yYW5nZVswXSksXG4gICAgICAgIHRleHRCdWZmZXIucG9zaXRpb25Gb3JDaGFyYWN0ZXJJbmRleChmaXgucmFuZ2VbMV0pXG4gICAgICApXG4gICAgICBsaW50ZXJGaXggPSB7XG4gICAgICAgIHBvc2l0aW9uOiBmaXhSYW5nZSxcbiAgICAgICAgcmVwbGFjZVdpdGg6IGZpeC50ZXh0XG4gICAgICB9XG4gICAgfVxuICAgIGxldCBtc2dDb2xcbiAgICBsZXQgbXNnRW5kTGluZVxuICAgIGxldCBtc2dFbmRDb2xcbiAgICBsZXQgZXNsaW50RnVsbFJhbmdlID0gZmFsc2VcblxuICAgIC8qXG4gICAgIE5vdGU6IEVTTGludCBwb3NpdGlvbnMgYXJlIDEtaW5kZXhlZCwgd2hpbGUgQXRvbSBleHBlY3RzIDAtaW5kZXhlZCxcbiAgICAgcG9zaXRpb25zLiBXZSBhcmUgc3VidHJhY3RpbmcgMSBmcm9tIHRoZXNlIHZhbHVlcyBoZXJlIHNvIHdlIGRvbid0IGhhdmUgdG9cbiAgICAga2VlcCBkb2luZyBzbyBpbiBsYXRlciB1c2VzLlxuICAgICAqL1xuICAgIGNvbnN0IG1zZ0xpbmUgPSBsaW5lIC0gMVxuICAgIGlmICh0eXBlb2YgZW5kQ29sdW1uID09PSAnbnVtYmVyJyAmJiB0eXBlb2YgZW5kTGluZSA9PT0gJ251bWJlcicpIHtcbiAgICAgIGVzbGludEZ1bGxSYW5nZSA9IHRydWVcbiAgICAgIC8vIEhlcmUgd2UgYWx3YXlzIHdhbnQgdGhlIGNvbHVtbiB0byBiZSBhIG51bWJlclxuICAgICAgbXNnQ29sID0gTWF0aC5tYXgoMCwgY29sdW1uIC0gMSlcbiAgICAgIG1zZ0VuZExpbmUgPSBlbmRMaW5lIC0gMVxuICAgICAgbXNnRW5kQ29sID0gZW5kQ29sdW1uIC0gMVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBXZSB3YW50IG1zZ0NvbCB0byByZW1haW4gdW5kZWZpbmVkIGlmIGl0IHdhcyBpbml0aWFsbHkgc29cbiAgICAgIC8vIGBnZW5lcmF0ZVJhbmdlYCB3aWxsIGdpdmUgdXMgYSByYW5nZSBvdmVyIHRoZSBlbnRpcmUgbGluZVxuICAgICAgbXNnQ29sID0gdHlwZW9mIGNvbHVtbiA9PT0gJ251bWJlcicgPyBjb2x1bW4gLSAxIDogY29sdW1uXG4gICAgfVxuXG4gICAgbGV0IHJldCA9IHtcbiAgICAgIHNldmVyaXR5OiBzZXZlcml0eSA9PT0gMSA/ICd3YXJuaW5nJyA6ICdlcnJvcicsXG4gICAgICBsb2NhdGlvbjoge1xuICAgICAgICBmaWxlOiBmaWxlUGF0aCxcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocnVsZUlkKSB7XG4gICAgICByZXQudXJsID0gcnVsZXMuZ2V0UnVsZVVybChydWxlSWQpXG4gICAgfVxuXG4gICAgLy8gSEFDSyBmb3IgaHR0cHM6Ly9naXRodWIuY29tL0F0b21MaW50ZXIvbGludGVyLWVzbGludC9pc3N1ZXMvMTI0OVxuICAgIGxldCBmaXhMaW5lRW5kaW5nID0gZmFsc2VcbiAgICBpZiAocnVsZUlkID09PSAncHJldHRpZXIvcHJldHRpZXInICYmIChtZXNzYWdlID09PSAnRGVsZXRlIGDikI1gJykpIHtcbiAgICAgIGZpeExpbmVFbmRpbmcgPSB0cnVlXG4gICAgfVxuXG4gICAgbGV0IHJhbmdlXG4gICAgdHJ5IHtcbiAgICAgIGlmIChlc2xpbnRGdWxsUmFuZ2UpIHtcbiAgICAgICAgaWYgKCFmaXhMaW5lRW5kaW5nKSB7XG4gICAgICAgICAgdGhyb3dJZkludmFsaWRQb2ludCh0ZXh0QnVmZmVyLCBtc2dMaW5lLCBtc2dDb2wpXG4gICAgICAgICAgdGhyb3dJZkludmFsaWRQb2ludCh0ZXh0QnVmZmVyLCBtc2dFbmRMaW5lLCBtc2dFbmRDb2wpXG4gICAgICAgIH1cbiAgICAgICAgcmFuZ2UgPSBbW21zZ0xpbmUsIG1zZ0NvbF0sIFttc2dFbmRMaW5lLCBtc2dFbmRDb2xdXVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmFuZ2UgPSBnZW5lcmF0ZVJhbmdlKHRleHRFZGl0b3IsIG1zZ0xpbmUsIG1zZ0NvbClcbiAgICAgIH1cbiAgICAgIHJldC5sb2NhdGlvbi5wb3NpdGlvbiA9IHJhbmdlXG5cbiAgICAgIGNvbnN0IHJ1bGVBcHBlbmRpeCA9IHNob3dSdWxlID8gYCAoJHtydWxlSWQgfHwgJ0ZhdGFsJ30pYCA6ICcnXG4gICAgICByZXQuZXhjZXJwdCA9IGAke21lc3NhZ2V9JHtydWxlQXBwZW5kaXh9YFxuXG4gICAgICBpZiAobGludGVyRml4KSB7XG4gICAgICAgIHJldC5zb2x1dGlvbnMgPSBbbGludGVyRml4XVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgcmV0ID0gYXdhaXQgZ2VuZXJhdGVJbnZhbGlkVHJhY2Uoe1xuICAgICAgICBtc2dMaW5lLFxuICAgICAgICBtc2dDb2wsXG4gICAgICAgIG1zZ0VuZExpbmUsXG4gICAgICAgIG1zZ0VuZENvbCxcbiAgICAgICAgZXNsaW50RnVsbFJhbmdlLFxuICAgICAgICBmaWxlUGF0aCxcbiAgICAgICAgdGV4dEVkaXRvcixcbiAgICAgICAgcnVsZUlkLFxuICAgICAgICBtZXNzYWdlLFxuICAgICAgfSlcbiAgICB9XG5cbiAgICByZXR1cm4gcmV0XG4gIH0pKVxufVxuXG4vKipcbiAqIFByb2Nlc3NlcyB0aGUgcmVzcG9uc2UgZnJvbSB0aGUgbGludCBqb2JcbiAqIEBwYXJhbSAge09iamVjdH0gICAgIHJlc3BvbnNlICAgVGhlIHJhdyByZXNwb25zZSBmcm9tIHRoZSBqb2JcbiAqIEBwYXJhbSAge1RleHRFZGl0b3J9IHRleHRFZGl0b3IgVGhlIEF0b206OlRleHRFZGl0b3Igb2YgdGhlIGZpbGUgdGhlIG1lc3NhZ2VzIGJlbG9uZyB0b1xuICogQHBhcmFtICB7Ym9vbH0gICAgICAgc2hvd1J1bGUgICBXaGV0aGVyIHRvIHNob3cgdGhlIHJ1bGUgaW4gdGhlIG1lc3NhZ2VzXG4gKiBAcmV0dXJuIHtQcm9taXNlfSAgICAgICAgICAgICAgIFRoZSBtZXNzYWdlcyB0cmFuc2Zvcm1lZCBpbnRvIExpbnRlciBtZXNzYWdlc1xuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcHJvY2Vzc0pvYlJlc3BvbnNlKHJlc3BvbnNlLCB0ZXh0RWRpdG9yLCBzaG93UnVsZSkge1xuICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHJlc3BvbnNlLCAndXBkYXRlZFJ1bGVzJykpIHtcbiAgICBydWxlcy5yZXBsYWNlUnVsZXMocmVzcG9uc2UudXBkYXRlZFJ1bGVzKVxuICB9XG4gIHJldHVybiBwcm9jZXNzRVNMaW50TWVzc2FnZXMocmVzcG9uc2UubWVzc2FnZXMsIHRleHRFZGl0b3IsIHNob3dSdWxlKVxufVxuIl19