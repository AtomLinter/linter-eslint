'use strict';
'use babel';

var _escapeHtml = require('escape-html');

var _escapeHtml2 = _interopRequireDefault(_escapeHtml);

var _eslintRuleDocumentation = require('eslint-rule-documentation');

var _eslintRuleDocumentation2 = _interopRequireDefault(_eslintRuleDocumentation);

var _atom = require('atom');

var _helpers = require('./helpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions


// Configuration
var scopes = [];
var showRule = void 0;
var ignoredRulesWhenModified = void 0;

module.exports = {
  activate: function activate() {
    var _this = this;

    require('atom-package-deps').install();

    this.subscriptions = new _atom.CompositeDisposable();
    this.active = true;
    this.worker = null;

    this.subscriptions.add(atom.config.observe('linter-eslint.scopes', function (value) {
      // Remove any old scopes
      scopes.splice(0, scopes.length);
      // Add the current scopes
      Array.prototype.push.apply(scopes, value);
    }));

    var embeddedScope = 'source.js.embedded.html';
    this.subscriptions.add(atom.config.observe('linter-eslint.lintHtmlFiles', function (lintHtmlFiles) {
      if (lintHtmlFiles) {
        scopes.push(embeddedScope);
      } else if (scopes.indexOf(embeddedScope) !== -1) {
        scopes.splice(scopes.indexOf(embeddedScope), 1);
      }
    }));

    this.subscriptions.add(atom.workspace.observeTextEditors(function (editor) {
      editor.onDidSave(function () {
        if (scopes.indexOf(editor.getGrammar().scopeName) !== -1 && atom.config.get('linter-eslint.fixOnSave')) {
          var filePath = editor.getPath();
          var projectPath = atom.project.relativizePath(filePath)[0];

          _this.worker.request('job', {
            type: 'fix',
            config: atom.config.get('linter-eslint'),
            filePath: filePath,
            projectPath: projectPath
          }).catch(function (response) {
            return atom.notifications.addWarning(response);
          });
        }
      });
    }));

    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'linter-eslint:debug': function () {
        var _ref = _asyncToGenerator(function* () {
          var debugString = yield (0, _helpers.generateDebugString)(_this.worker);
          var notificationOptions = { detail: debugString, dismissable: true };
          atom.notifications.addInfo('linter-eslint debugging information', notificationOptions);
        });

        return function linterEslintDebug() {
          return _ref.apply(this, arguments);
        };
      }()
    }));

    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'linter-eslint:fix-file': function linterEslintFixFile() {
        var textEditor = atom.workspace.getActiveTextEditor();
        var filePath = textEditor.getPath();
        var projectPath = atom.project.relativizePath(filePath)[0];

        if (!textEditor || textEditor.isModified()) {
          // Abort for invalid or unsaved text editors
          atom.notifications.addError('Linter-ESLint: Please save before fixing');
          return;
        }

        _this.worker.request('job', {
          type: 'fix',
          config: atom.config.get('linter-eslint'),
          filePath: filePath,
          projectPath: projectPath
        }).then(function (response) {
          return atom.notifications.addSuccess(response);
        }).catch(function (response) {
          return atom.notifications.addWarning(response);
        });
      }
    }));

    this.subscriptions.add(atom.config.observe('linter-eslint.showRuleIdInMessage', function (value) {
      showRule = value;
    }));

    this.subscriptions.add(atom.config.observe('linter-eslint.rulesToSilenceWhileTyping', function (ids) {
      ignoredRulesWhenModified = (0, _helpers.idsToIgnoredRules)(ids);
    }));

    var initializeWorker = function initializeWorker() {
      var _spawnWorker = (0, _helpers.spawnWorker)();

      var worker = _spawnWorker.worker;
      var subscription = _spawnWorker.subscription;

      _this.worker = worker;
      _this.subscriptions.add(subscription);
      worker.onDidExit(function () {
        if (_this.active) {
          (0, _helpers.showError)('Worker died unexpectedly', 'Check your console for more ' + 'info. A new worker will be spawned instantly.');
          setTimeout(initializeWorker, 1000);
        }
      });
    };
    initializeWorker();
  },
  deactivate: function deactivate() {
    this.active = false;
    this.subscriptions.dispose();
  },
  provideLinter: function provideLinter() {
    var _this2 = this;

    var Helpers = require('atom-linter');

    return {
      name: 'ESLint',
      grammarScopes: scopes,
      scope: 'file',
      lintOnFly: true,
      lint: function lint(textEditor) {
        var text = textEditor.getText();
        if (text.length === 0) {
          return Promise.resolve([]);
        }
        var filePath = textEditor.getPath();

        var rules = {};
        if (textEditor.isModified() && Object.keys(ignoredRulesWhenModified).length > 0) {
          rules = ignoredRulesWhenModified;
        }

        return _this2.worker.request('job', {
          type: 'lint',
          contents: text,
          config: atom.config.get('linter-eslint'),
          rules: rules,
          filePath: filePath,
          projectPath: atom.project.relativizePath(filePath)[0] || ''
        }).then(function (response) {
          if (textEditor.getText() !== text) {
            /*
               The editor text has been modified since the lint was triggered,
               as we can't be sure that the results will map properly back to
               the new contents, simply return `null` to tell the
               `provideLinter` consumer not to update the saved results.
             */
            return null;
          }
          var messagePromises = response.map(function () {
            var _ref2 = _asyncToGenerator(function* (_ref3) {
              var message = _ref3.message;
              var line = _ref3.line;
              var severity = _ref3.severity;
              var ruleId = _ref3.ruleId;
              var column = _ref3.column;
              var fix = _ref3.fix;
              var endLine = _ref3.endLine;
              var endColumn = _ref3.endColumn;

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
                  (0, _helpers.validatePoint)(textEditor, msgLine, msgCol);
                  (0, _helpers.validatePoint)(textEditor, msgEndLine, msgEndCol);
                  range = [[msgLine, msgCol], [msgEndLine, msgEndCol]];
                } else {
                  range = Helpers.rangeFromLineNumber(textEditor, msgLine, msgCol);
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
                var body = encodeURIComponent(['ESLint returned a point that did not exist in the document being edited.', 'Rule: ' + ruleId, rangeText, '', '', '<!-- If at all possible, please include code to reproduce this issue! -->', '', '', 'Debug information:', '```json', JSON.stringify((yield (0, _helpers.getDebugInfo)()), null, 2), '```'].join('\n'));
                var newIssueURL = issueURL + '?title=' + title + '&body=' + body;
                ret = {
                  type: 'Error',
                  severity: 'error',
                  html: (0, _escapeHtml2.default)(titleText) + '. See the trace for details. ' + ('<a href="' + newIssueURL + '">Report this!</a>'),
                  filePath: filePath,
                  range: Helpers.rangeFromLineNumber(textEditor, 0),
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

            return function (_x) {
              return _ref2.apply(this, arguments);
            };
          }());

          return Promise.all(messagePromises).then(function (messages) {
            return messages;
          });
        });
      }
    };
  }
};
