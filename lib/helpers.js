'use strict';
'use babel';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.processESLintMessages = exports.generateDebugString = exports.getDebugInfo = undefined;

let getDebugInfo = exports.getDebugInfo = (() => {
  var _ref = _asyncToGenerator(function* (worker) {
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
      linterEslintMeta = { version: 'unknown!' };
    } else {
      // eslint-disable-next-line import/no-dynamic-require
      linterEslintMeta = require((0, _path.join)(packagePath, 'package.json'));
    }
    const config = atom.config.get('linter-eslint');
    const hoursSinceRestart = Math.round(process.uptime() / 3600 * 10) / 10;
    let returnVal;
    try {
      const response = yield worker.request('job', {
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
  });

  return function getDebugInfo(_x3) {
    return _ref.apply(this, arguments);
  };
})();

let generateDebugString = exports.generateDebugString = (() => {
  var _ref2 = _asyncToGenerator(function* (worker) {
    const debug = yield getDebugInfo(worker);
    const details = [`Atom version: ${debug.atomVersion}`, `linter-eslint version: ${debug.linterEslintVersion}`, `ESLint version: ${debug.eslintVersion}`, `Hours since last Atom restart: ${debug.hoursSinceRestart}`, `Platform: ${debug.platform}`, `Using ${debug.eslintType} ESLint from: ${debug.eslintPath}`, `Current file's scopes: ${JSON.stringify(debug.editorScopes, null, 2)}`, `linter-eslint configuration: ${JSON.stringify(debug.linterEslintConfig, null, 2)}`];
    return details.join('\n');
  });

  return function generateDebugString(_x4) {
    return _ref2.apply(this, arguments);
  };
})();

/**
 * Given a raw response from ESLint, this processes the messages into a format
 * compatible with the Linter API.
 * @param  {Object}     response   The raw response from ESLint
 * @param  {TextEditor} textEditor The Atom::TextEditor of the file the messages belong to
 * @param  {bool}       showRule   Whether to show the rule in the messages
 * @param  {Object}     worker     The current Worker process to send Debug jobs to
 * @return {Promise}               The messages transformed into Linter messages
 */
let processESLintMessages = exports.processESLintMessages = (() => {
  var _ref4 = _asyncToGenerator(function* (response, textEditor, showRule, worker) {
    return Promise.all(response.map((() => {
      var _ref6 = _asyncToGenerator(function* (_ref5) {
        let message = _ref5.message,
            line = _ref5.line,
            severity = _ref5.severity,
            ruleId = _ref5.ruleId,
            column = _ref5.column,
            fix = _ref5.fix,
            endLine = _ref5.endLine,
            endColumn = _ref5.endColumn;

        const filePath = textEditor.getPath();
        const textBuffer = textEditor.getBuffer();
        let linterFix = null;
        if (fix) {
          const fixRange = new _atom.Range(textBuffer.positionForCharacterIndex(fix.range[0]), textBuffer.positionForCharacterIndex(fix.range[1]));
          linterFix = {
            range: fixRange,
            newText: fix.text
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
        if (typeof endColumn !== 'undefined' && typeof endLine !== 'undefined') {
          eslintFullRange = true;
          // Here we always want the column to be a number
          msgCol = Math.max(0, column - 1);
          msgEndLine = endLine - 1;
          msgEndCol = endColumn - 1;
        } else {
          // We want msgCol to remain undefined if it was initially so
          // `generateRange` will give us a range over the entire line
          msgCol = typeof column !== 'undefined' ? column - 1 : column;
        }

        let ret;
        let range;
        try {
          if (eslintFullRange) {
            validatePoint(textEditor, msgLine, msgCol);
            validatePoint(textEditor, msgEndLine, msgEndCol);
            range = [[msgLine, msgCol], [msgEndLine, msgEndCol]];
          } else {
            range = (0, _atomLinter.generateRange)(textEditor, msgLine, msgCol);
          }
          ret = {
            filePath,
            type: severity === 1 ? 'Warning' : 'Error',
            range
          };

          if (showRule) {
            const elName = ruleId ? 'a' : 'span';
            const href = ruleId ? ` href="${(0, _eslintRuleDocumentation2.default)(ruleId).url}"` : '';
            ret.html = `${(0, _escapeHtml2.default)(message)} (<${elName}${href}>${ruleId || 'Fatal'}</${elName}>)`;
          } else {
            ret.text = message;
          }
          if (linterFix) {
            ret.fix = linterFix;
          }
        } catch (err) {
          if (!err.message.startsWith('Line number ') && !err.message.startsWith('Column start ')) {
            // This isn't an invalid point error from `generateRange`, re-throw it
            throw err;
          }
          ret = yield generateInvalidTrace(msgLine, msgCol, msgEndLine, msgEndCol, eslintFullRange, filePath, textEditor, ruleId, message, worker);
        }

        return ret;
      });

      return function (_x19) {
        return _ref6.apply(this, arguments);
      };
    })()));
  });

  return function processESLintMessages(_x15, _x16, _x17, _x18) {
    return _ref4.apply(this, arguments);
  };
})();

exports.spawnWorker = spawnWorker;
exports.showError = showError;
exports.idsToIgnoredRules = idsToIgnoredRules;

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

var _processCommunication = require('process-communication');

var _path = require('path');

var _escapeHtml = require('escape-html');

var _escapeHtml2 = _interopRequireDefault(_escapeHtml);

var _eslintRuleDocumentation = require('eslint-rule-documentation');

var _eslintRuleDocumentation2 = _interopRequireDefault(_eslintRuleDocumentation);

var _atomLinter = require('atom-linter');

var _atom = require('atom');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions


const RULE_OFF_SEVERITY = 0;

function spawnWorker() {
  const env = Object.create(process.env);

  delete env.NODE_PATH;
  delete env.NODE_ENV;
  delete env.OS;

  const child = _child_process2.default.fork((0, _path.join)(__dirname, 'worker.js'), [], { env, silent: true });
  const worker = (0, _processCommunication.createFromProcess)(child);

  child.stdout.on('data', chunk => {
    console.log('[Linter-ESLint] STDOUT', chunk.toString());
  });
  child.stderr.on('data', chunk => {
    console.log('[Linter-ESLint] STDERR', chunk.toString());
  });

  return {
    worker,
    subscription: new _atom.Disposable(() => {
      worker.kill();
    })
  };
}

function showError(givenMessage) {
  let givenDetail = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

  let detail;
  let message;
  if (message instanceof Error) {
    detail = message.stack;
    message = message.message;
  } else {
    detail = givenDetail;
    message = givenMessage;
  }
  atom.notifications.addError(`[Linter-ESLint] ${message}`, {
    detail,
    dismissable: true
  });
}

function idsToIgnoredRules() {
  let ruleIds = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

  return ruleIds.reduce((ids, id) => {
    ids[id] = RULE_OFF_SEVERITY;
    return ids;
  }, {});
}

function validatePoint(textEditor, line, col) {
  const buffer = textEditor.getBuffer();
  // Clip the given point to a valid one, and check if it equals the original
  if (!buffer.clipPosition([line, col]).isEqual([line, col])) {
    throw new Error(`${line}:${col} isn't a valid point!`);
  }
}

const generateInvalidTrace = (() => {
  var _ref3 = _asyncToGenerator(function* (msgLine, msgCol, msgEndLine, msgEndCol, eslintFullRange, filePath, textEditor, ruleId, message, worker) {
    let errMsgRange = `${msgLine + 1}:${msgCol}`;
    if (eslintFullRange) {
      errMsgRange += ` - ${msgEndLine + 1}:${msgEndCol + 1}`;
    }
    const rangeText = `Requested ${eslintFullRange ? 'start point' : 'range'}: ${errMsgRange}`;
    const issueURL = 'https://github.com/AtomLinter/linter-eslint/issues/new';
    const titleText = `Invalid position given by '${ruleId}'`;
    const title = encodeURIComponent(titleText);
    const body = encodeURIComponent(['ESLint returned a point that did not exist in the document being edited.', `Rule: \`${ruleId}\``, rangeText, '', '', '<!-- If at all possible, please include code to reproduce this issue! -->', '', '', 'Debug information:', '```json', JSON.stringify((yield getDebugInfo(worker)), null, 2), '```'].join('\n'));
    const newIssueURL = `${issueURL}?title=${title}&body=${body}`;
    return {
      type: 'Error',
      severity: 'error',
      html: `${(0, _escapeHtml2.default)(titleText)}. See the trace for details. ` + `<a href="${newIssueURL}">Report this!</a>`,
      filePath,
      range: (0, _atomLinter.generateRange)(textEditor, 0),
      trace: [{
        type: 'Trace',
        text: `Original message: ${ruleId} - ${message}`,
        filePath,
        severity: 'info'
      }, {
        type: 'Trace',
        text: rangeText,
        filePath,
        severity: 'info'
      }]
    };
  });

  return function generateInvalidTrace(_x5, _x6, _x7, _x8, _x9, _x10, _x11, _x12, _x13, _x14) {
    return _ref3.apply(this, arguments);
  };
})();