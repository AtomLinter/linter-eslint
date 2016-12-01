'use strict';
'use babel';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.processMessages = exports.generateDebugString = exports.getDebugInfo = undefined;

var getDebugInfo = exports.getDebugInfo = function () {
  var _ref = _asyncToGenerator(function* (worker) {
    var textEditor = atom.workspace.getActiveTextEditor();
    var filePath = textEditor.getPath();
    var packagePath = atom.packages.resolvePackagePath('linter-eslint');
    // eslint-disable-next-line import/no-dynamic-require
    var linterEslintMeta = require((0, _path.join)(packagePath, 'package.json'));
    var config = atom.config.get('linter-eslint');
    var hoursSinceRestart = Math.round(process.uptime() / 3600 * 10) / 10;
    var returnVal = void 0;
    try {
      var response = yield worker.request('job', {
        type: 'debug',
        config: config,
        filePath: filePath
      });
      returnVal = {
        atomVersion: atom.getVersion(),
        linterEslintVersion: linterEslintMeta.version,
        linterEslintConfig: config,
        // eslint-disable-next-line import/no-dynamic-require
        eslintVersion: require((0, _path.join)(response.path, 'package.json')).version,
        hoursSinceRestart: hoursSinceRestart,
        platform: process.platform,
        eslintType: response.type,
        eslintPath: response.path
      };
    } catch (error) {
      atom.notifications.addError('' + error);
    }
    return returnVal;
  });

  return function getDebugInfo(_x3) {
    return _ref.apply(this, arguments);
  };
}();

var generateDebugString = exports.generateDebugString = function () {
  var _ref2 = _asyncToGenerator(function* (worker) {
    var debug = yield getDebugInfo(worker);
    var details = ['Atom version: ' + debug.atomVersion, 'linter-eslint version: ' + debug.linterEslintVersion, 'ESLint version: ' + debug.eslintVersion, 'Hours since last Atom restart: ' + debug.hoursSinceRestart, 'Platform: ' + debug.platform, 'Using ' + debug.eslintType + ' ESLint from ' + debug.eslintPath, 'linter-eslint configuration: ' + JSON.stringify(debug.linterEslintConfig, null, 2)];
    return details.join('\n');
  });

  return function generateDebugString(_x4) {
    return _ref2.apply(this, arguments);
  };
}();

var processMessages = exports.processMessages = function () {
  var _ref3 = _asyncToGenerator(function* (response, textEditor, showRule) {
    return Promise.all(response.map(function () {
      var _ref4 = _asyncToGenerator(function* (_ref5) {
        var message = _ref5.message,
            line = _ref5.line,
            severity = _ref5.severity,
            ruleId = _ref5.ruleId,
            column = _ref5.column,
            fix = _ref5.fix,
            endLine = _ref5.endLine,
            endColumn = _ref5.endColumn;

        var filePath = textEditor.getPath();
        var textBuffer = textEditor.getBuffer();
        var linterFix = null;
        if (fix) {
          var fixRange = new _atom.Range(textBuffer.positionForCharacterIndex(fix.range[0]), textBuffer.positionForCharacterIndex(fix.range[1]));
          linterFix = {
            range: fixRange,
            newText: fix.text
          };
        }
        var msgLine = line - 1;
        var msgCol = void 0;
        var msgEndLine = void 0;
        var msgEndCol = void 0;
        var eslintFullRange = false;
        if (typeof endColumn !== 'undefined' && typeof endLine !== 'undefined') {
          eslintFullRange = true;
          // Here we always want the column to be a number
          msgCol = Math.max(0, column - 1);
          msgEndLine = endLine - 1;
          msgEndCol = endColumn - 1;
        } else {
          // We want msgCol to remain undefined if it was initially so
          // `rangeFromLineNumber` will give us a range over the entire line
          msgCol = typeof column !== 'undefined' ? column - 1 : column;
        }

        var ret = void 0;
        var range = void 0;
        try {
          if (eslintFullRange) {
            validatePoint(textEditor, msgLine, msgCol);
            validatePoint(textEditor, msgEndLine, msgEndCol);
            range = [[msgLine, msgCol], [msgEndLine, msgEndCol]];
          } else {
            range = (0, _atomLinter.rangeFromLineNumber)(textEditor, msgLine, msgCol);
          }
          ret = {
            filePath: filePath,
            type: severity === 1 ? 'Warning' : 'Error',
            range: range
          };

          if (showRule) {
            var elName = ruleId ? 'a' : 'span';
            var href = ruleId ? ' href=' + (0, _eslintRuleDocumentation2.default)(ruleId).url : '';
            ret.html = '<' + elName + href + ' class="badge badge-flexible eslint">' + ((ruleId || 'Fatal') + '</' + elName + '> ' + (0, _escapeHtml2.default)(message));
          } else {
            ret.text = message;
          }
          if (linterFix) {
            ret.fix = linterFix;
          }
        } catch (err) {
          var errMsgRange = msgLine + 1 + ':' + msgCol;
          if (eslintFullRange) {
            errMsgRange += ' - ' + (msgEndLine + 1) + ':' + (msgEndCol + 1);
          }
          var rangeText = 'Requested ' + (eslintFullRange ? 'start point' : 'range') + ': ' + errMsgRange;
          var issueURL = 'https://github.com/AtomLinter/linter-eslint/issues/new';
          var titleText = 'Invalid position given by \'' + ruleId + '\'';
          var title = encodeURIComponent(titleText);
          var body = encodeURIComponent(['ESLint returned a point that did not exist in the document being edited.', 'Rule: ' + ruleId, rangeText, '', '', '<!-- If at all possible, please include code to reproduce this issue! -->', '', '', 'Debug information:', '```json', JSON.stringify((yield getDebugInfo()), null, 2), '```'].join('\n'));
          var newIssueURL = issueURL + '?title=' + title + '&body=' + body;
          ret = {
            type: 'Error',
            severity: 'error',
            html: (0, _escapeHtml2.default)(titleText) + '. See the trace for details. ' + ('<a href="' + newIssueURL + '">Report this!</a>'),
            filePath: filePath,
            range: (0, _atomLinter.rangeFromLineNumber)(textEditor, 0),
            trace: [{
              type: 'Trace',
              text: 'Original message: ' + ruleId + ' - ' + message,
              filePath: filePath,
              severity: 'info'
            }, {
              type: 'Trace',
              text: rangeText,
              filePath: filePath,
              severity: 'info'
            }]
          };
        }

        return ret;
      });

      return function (_x8) {
        return _ref4.apply(this, arguments);
      };
    }()));
  });

  return function processMessages(_x5, _x6, _x7) {
    return _ref3.apply(this, arguments);
  };
}();

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


var RULE_OFF_SEVERITY = 0;

function spawnWorker() {
  var env = Object.create(process.env);

  delete env.NODE_PATH;
  delete env.NODE_ENV;
  delete env.OS;

  var child = _child_process2.default.fork((0, _path.join)(__dirname, 'worker.js'), [], { env: env, silent: true });
  var worker = (0, _processCommunication.createFromProcess)(child);

  child.stdout.on('data', function (chunk) {
    console.log('[Linter-ESLint] STDOUT', chunk.toString());
  });
  child.stderr.on('data', function (chunk) {
    console.log('[Linter-ESLint] STDERR', chunk.toString());
  });

  return {
    worker: worker,
    subscription: new _atom.Disposable(function () {
      worker.kill();
    })
  };
}

function showError(givenMessage) {
  var givenDetail = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

  var detail = void 0;
  var message = void 0;
  if (message instanceof Error) {
    detail = message.stack;
    message = message.message;
  } else {
    detail = givenDetail;
    message = givenMessage;
  }
  atom.notifications.addError('[Linter-ESLint] ' + message, {
    detail: detail,
    dismissable: true
  });
}

function idsToIgnoredRules() {
  var ruleIds = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

  return ruleIds.reduce(function (ids, id) {
    ids[id] = RULE_OFF_SEVERITY;
    return ids;
  }, {});
}

function validatePoint(textEditor, line, col) {
  var buffer = textEditor.getBuffer();
  // Clip the given point to a valid one, and check if it equals the original
  if (!buffer.clipPosition([line, col]).isEqual([line, col])) {
    throw new Error(line + ':' + col + ' isn\'t a valid point!');
  }
}
