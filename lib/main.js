'use strict';
'use babel';

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _atom = require('atom');

var _helpers = require('./helpers');

var _workerHelpers = require('./worker-helpers');

var _isConfigAtHomeRoot = require('./is-config-at-home-root');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }
// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions


// Configuration
const scopes = [];
let showRule;
let ignoredRulesWhenModified;
let ignoredRulesWhenFixing;
let disableWhenNoEslintConfig;

module.exports = {
  activate() {
    var _this = this;

    require('atom-package-deps').install();

    this.subscriptions = new _atom.CompositeDisposable();
    this.active = true;
    this.worker = null;

    this.subscriptions.add(atom.config.observe('linter-eslint.scopes', value => {
      // Remove any old scopes
      scopes.splice(0, scopes.length);
      // Add the current scopes
      Array.prototype.push.apply(scopes, value);
    }));

    const embeddedScope = 'source.js.embedded.html';
    this.subscriptions.add(atom.config.observe('linter-eslint.lintHtmlFiles', lintHtmlFiles => {
      if (lintHtmlFiles) {
        scopes.push(embeddedScope);
      } else if (scopes.indexOf(embeddedScope) !== -1) {
        scopes.splice(scopes.indexOf(embeddedScope), 1);
      }
    }));

    this.subscriptions.add(atom.workspace.observeTextEditors(editor => {
      editor.onDidSave(() => {
        const validScope = editor.getCursors().some(cursor => cursor.getScopeDescriptor().getScopesArray().some(scope => scopes.includes(scope)));
        if (validScope && atom.config.get('linter-eslint.fixOnSave')) {
          const filePath = editor.getPath();
          const projectPath = atom.project.relativizePath(filePath)[0];

          // Do not try to fix if linting should be disabled
          const fileDir = _path2.default.dirname(filePath);
          const configPath = (0, _workerHelpers.getConfigPath)(fileDir);
          const noProjectConfig = configPath === null || (0, _isConfigAtHomeRoot.isConfigAtHomeRoot)(configPath);
          if (noProjectConfig && disableWhenNoEslintConfig) return;

          let rules = {};
          if (Object.keys(ignoredRulesWhenFixing).length > 0) {
            rules = ignoredRulesWhenFixing;
          }

          this.worker.request('job', {
            type: 'fix',
            config: atom.config.get('linter-eslint'),
            rules,
            filePath,
            projectPath
          }).catch(err => {
            atom.notifications.addWarning(err.message);
          });
        }
      });
    }));

    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'linter-eslint:debug': (() => {
        var _ref = _asyncToGenerator(function* () {
          const debugString = yield (0, _helpers.generateDebugString)(_this.worker);
          const notificationOptions = { detail: debugString, dismissable: true };
          atom.notifications.addInfo('linter-eslint debugging information', notificationOptions);
        });

        return function linterEslintDebug() {
          return _ref.apply(this, arguments);
        };
      })()
    }));

    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'linter-eslint:fix-file': () => {
        const textEditor = atom.workspace.getActiveTextEditor();
        const filePath = textEditor.getPath();
        const projectPath = atom.project.relativizePath(filePath)[0];

        if (!textEditor || textEditor.isModified()) {
          // Abort for invalid or unsaved text editors
          atom.notifications.addError('Linter-ESLint: Please save before fixing');
          return;
        }

        let rules = {};
        if (textEditor.isModified() && Object.keys(ignoredRulesWhenFixing).length > 0) {
          rules = ignoredRulesWhenFixing;
        }

        this.worker.request('job', {
          type: 'fix',
          config: atom.config.get('linter-eslint'),
          rules,
          filePath,
          projectPath
        }).then(response => atom.notifications.addSuccess(response)).catch(err => {
          atom.notifications.addWarning(err.message);
        });
      }
    }));

    this.subscriptions.add(atom.config.observe('linter-eslint.showRuleIdInMessage', value => {
      showRule = value;
    }));

    this.subscriptions.add(atom.config.observe('linter-eslint.disableWhenNoEslintConfig', value => {
      disableWhenNoEslintConfig = value;
    }));

    this.subscriptions.add(atom.config.observe('linter-eslint.rulesToSilenceWhileTyping', ids => {
      ignoredRulesWhenModified = (0, _helpers.idsToIgnoredRules)(ids);
    }));

    this.subscriptions.add(atom.config.observe('linter-eslint.rulesToDisableWhileFixing', ids => {
      ignoredRulesWhenFixing = (0, _helpers.idsToIgnoredRules)(ids);
    }));

    const initializeWorker = () => {
      var _spawnWorker = (0, _helpers.spawnWorker)();

      const worker = _spawnWorker.worker,
            subscription = _spawnWorker.subscription;

      this.worker = worker;
      this.subscriptions.add(subscription);
      worker.onDidExit(() => {
        if (this.active) {
          (0, _helpers.showError)('Worker died unexpectedly', 'Check your console for more ' + 'info. A new worker will be spawned instantly.');
          setTimeout(initializeWorker, 1000);
        }
      });
    };
    initializeWorker();
  },
  deactivate() {
    this.active = false;
    this.subscriptions.dispose();
  },
  provideLinter() {
    return {
      name: 'ESLint',
      grammarScopes: scopes,
      scope: 'file',
      lintOnFly: true,
      lint: textEditor => {
        const text = textEditor.getText();
        if (text.length === 0) {
          return Promise.resolve([]);
        }
        const filePath = textEditor.getPath();

        let rules = {};
        if (textEditor.isModified() && Object.keys(ignoredRulesWhenModified).length > 0) {
          rules = ignoredRulesWhenModified;
        }

        return this.worker.request('job', {
          type: 'lint',
          contents: text,
          config: atom.config.get('linter-eslint'),
          rules,
          filePath,
          projectPath: atom.project.relativizePath(filePath)[0] || ''
        }).then(response => {
          if (textEditor.getText() !== text) {
            /*
               The editor text has been modified since the lint was triggered,
               as we can't be sure that the results will map properly back to
               the new contents, simply return `null` to tell the
               `provideLinter` consumer not to update the saved results.
             */
            return null;
          }
          return (0, _helpers.processESLintMessages)(response, textEditor, showRule, this.worker);
        });
      }
    };
  }
};