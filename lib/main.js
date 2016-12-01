'use strict';
'use babel';

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions

var _atom = require('atom');

var _helpers = require('./helpers');

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

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
      var _spawnWorker = (0, _helpers.spawnWorker)(),
          worker = _spawnWorker.worker,
          subscription = _spawnWorker.subscription;

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
          return (0, _helpers.processMessages)(response, textEditor, showRule, _this2.worker);
        });
      }
    };
  }
};
