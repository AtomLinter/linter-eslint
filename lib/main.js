'use strict';
'use babel';

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _escapeHtml = require('escape-html');

var _escapeHtml2 = _interopRequireDefault(_escapeHtml);

var _eslintRuleDocumentation = require('eslint-rule-documentation');

var _eslintRuleDocumentation2 = _interopRequireDefault(_eslintRuleDocumentation);

var _atom = require('atom');

var _helpers = require('./helpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Configuration


// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
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
      'linter-eslint:debug': function linterEslintDebug() {
        var textEditor = atom.workspace.getActiveTextEditor();
        var filePath = textEditor.getPath();
        // eslint-disable-next-line import/no-dynamic-require
        var linterEslintMeta = require(_path2.default.join(atom.packages.resolvePackagePath('linter-eslint'), 'package.json'));
        var config = atom.config.get('linter-eslint');
        var configString = JSON.stringify(config, null, 2);
        var hoursSinceRestart = process.uptime() / 3600;
        _this.worker.request('job', {
          type: 'debug',
          config: config,
          filePath: filePath
        }).then(function (response) {
          var detail = ['atom version: ' + atom.getVersion(), 'linter-eslint version: ' + linterEslintMeta.version,
          // eslint-disable-next-line import/no-dynamic-require
          'eslint version: ' + require(_path2.default.join(response.path, 'package.json')).version, 'hours since last atom restart: ' + Math.round(hoursSinceRestart * 10) / 10, 'platform: ' + process.platform, 'Using ' + response.type + ' eslint from ' + response.path, 'linter-eslint configuration: ' + configString].join('\n');
          var notificationOptions = { detail: detail, dismissable: true };
          atom.notifications.addInfo('linter-eslint debugging information', notificationOptions);
        }).catch(function (response) {
          atom.notifications.addError('' + response);
        });
      }
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
          return response.map(function (_ref) {
            var message = _ref.message;
            var line = _ref.line;
            var severity = _ref.severity;
            var ruleId = _ref.ruleId;
            var column = _ref.column;
            var fix = _ref.fix;
            var endLine = _ref.endLine;
            var endColumn = _ref.endColumn;

            var textBuffer = textEditor.getBuffer();
            var linterFix = null;
            if (fix) {
              var fixRange = new _atom.Range(textBuffer.positionForCharacterIndex(fix.range[0]), textBuffer.positionForCharacterIndex(fix.range[1]));
              linterFix = {
                range: fixRange,
                newText: fix.text
              };
            }
            var range = void 0;
            var msgLine = line - 1;
            try {
              if (typeof endColumn !== 'undefined' && typeof endLine !== 'undefined') {
                // Here we always want the column to be a number
                var msgCol = Math.max(0, column - 1);
                (0, _helpers.validatePoint)(textEditor, msgLine, msgCol);
                (0, _helpers.validatePoint)(textEditor, endLine - 1, endColumn - 1);
                range = [[msgLine, msgCol], [endLine - 1, endColumn - 1]];
              } else {
                // We want msgCol to remain undefined if it was initially so
                // `rangeFromLineNumber` will give us a range over the entire line
                var _msgCol = typeof column !== 'undefined' ? column - 1 : column;
                range = Helpers.rangeFromLineNumber(textEditor, msgLine, _msgCol);
              }
            } catch (err) {
              throw new Error('Cannot mark location in editor for (' + ruleId + ') - (' + message + ')' + (' at line (' + line + ') column (' + column + ')'));
            }
            var ret = {
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

            return ret;
          });
        });
      }
    };
  }
};
