'use strict';
'use babel';

var _atom = require('atom');

var _helpers = require('./helpers');

var _escapeHtml = require('escape-html');

var _escapeHtml2 = _interopRequireDefault(_escapeHtml);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = {
  config: {
    lintHtmlFiles: {
      title: 'Lint HTML Files',
      description: 'You should also add `eslint-plugin-html` to your .eslintrc plugins',
      type: 'boolean',
      default: false
    },
    useGlobalEslint: {
      title: 'Use global ESLint installation',
      description: 'Make sure you have it in your $PATH',
      type: 'boolean',
      default: false
    },
    showRuleIdInMessage: {
      title: 'Show Rule ID in Messages',
      type: 'boolean',
      default: true
    },
    disableWhenNoEslintConfig: {
      title: 'Disable when no ESLint config is found (in package.json or .eslintrc)',
      type: 'boolean',
      default: true
    },
    eslintrcPath: {
      title: '.eslintrc Path',
      description: "It will only be used when there's no config file in project",
      type: 'string',
      default: ''
    },
    globalNodePath: {
      title: 'Global Node Installation Path',
      description: 'Write the value of `npm get prefix` here',
      type: 'string',
      default: ''
    },
    eslintRulesDir: {
      title: 'ESLint Rules Dir',
      description: 'Specify a directory for ESLint to load rules from',
      type: 'string',
      default: ''
    },
    disableEslintIgnore: {
      title: 'Disable using .eslintignore files',
      type: 'boolean',
      default: false
    },
    disableFSCache: {
      title: 'Disable FileSystem Cache',
      description: 'Paths of node_modules, .eslintignore and others are cached',
      type: 'boolean',
      default: false
    }
  },
  activate: function () {
    var _this = this;

    require('atom-package-deps').install();

    this.subscriptions = new _atom.CompositeDisposable();
    this.active = true;
    this.worker = null;
    this.scopes = ['source.js', 'source.jsx', 'source.js.jsx', 'source.babel', 'source.js-semantic'];

    const embeddedScope = 'source.js.embedded.html';
    this.subscriptions.add(atom.config.observe('linter-eslint.lintHtmlFiles', function (lintHtmlFiles) {
      if (lintHtmlFiles) {
        _this.scopes.push(embeddedScope);
      } else {
        if (_this.scopes.indexOf(embeddedScope) !== -1) {
          _this.scopes.splice(_this.scopes.indexOf(embeddedScope), 1);
        }
      }
    }));
    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'linter-eslint:fix-file': function () {
        const textEditor = atom.workspace.getActiveTextEditor();
        const filePath = textEditor.getPath();

        if (!textEditor || textEditor.isModified()) {
          // Abort for invalid or unsaved text editors
          atom.notifications.addError('Linter-ESLint: Please save before fixing');
          return;
        }

        _this.worker.request('job', {
          type: 'fix',
          config: atom.config.get('linter-eslint'),
          filePath: filePath
        }).then(function (response) {
          return atom.notifications.addSuccess(response);
        }).catch(function (response) {
          return atom.notifications.addWarning(response);
        });
      }
    }));

    const initializeWorker = function () {
      var _spawnWorker = (0, _helpers.spawnWorker)();

      const worker = _spawnWorker.worker;
      const subscription = _spawnWorker.subscription;

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
  deactivate: function () {
    this.active = false;
    this.subscriptions.dispose();
  },
  provideLinter: function () {
    var _this2 = this;

    const Helpers = require('atom-linter');
    return {
      name: 'ESLint',
      grammarScopes: this.scopes,
      scope: 'file',
      lintOnFly: true,
      lint: function (textEditor) {
        const text = textEditor.getText();
        if (text.length === 0) {
          return Promise.resolve([]);
        }
        const filePath = textEditor.getPath();
        const showRule = atom.config.get('linter-eslint.showRuleIdInMessage');

        return _this2.worker.request('job', {
          contents: text,
          type: 'lint',
          config: atom.config.get('linter-eslint'),
          filePath: filePath
        }).then(function (response) {
          return response.map(function (_ref) {
            let message = _ref.message;
            let line = _ref.line;
            let severity = _ref.severity;
            let ruleId = _ref.ruleId;
            let column = _ref.column;
            let fix = _ref.fix;

            const textBuffer = textEditor.getBuffer();
            let linterFix = null;
            if (fix) {
              const fixRange = new _atom.Range(textBuffer.positionForCharacterIndex(fix.range[0]), textBuffer.positionForCharacterIndex(fix.range[1]));
              linterFix = {
                range: fixRange,
                newText: fix.text
              };
            }
            const range = Helpers.rangeFromLineNumber(textEditor, line - 1);
            if (column) {
              range[0][1] = column - 1;
            }
            if (column > range[1][1]) {
              range[1][1] = column - 1;
            }
            const ret = {
              filePath: filePath,
              type: severity === 1 ? 'Warning' : 'Error',
              range: range
            };
            if (showRule) {
              ret.html = '<span class="badge badge-flexible">' + `${ ruleId || 'Fatal' }</span>${ (0, _escapeHtml2.default)(message) }`;
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
