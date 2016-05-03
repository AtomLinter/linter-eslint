'use strict';
'use babel';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.spawnWorker = spawnWorker;
exports.showError = showError;
exports.ruleURI = ruleURI;

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

var _atom = require('atom');

var _processCommunication = require('process-communication');

var _path = require('path');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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

  return { worker: worker, subscription: new _atom.Disposable(function () {
      worker.kill();
    }) };
}

function showError(givenMessage) {
  var givenDetail = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

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

function ruleURI(ruleId) {
  var ruleParts = ruleId.split('/');

  if (ruleParts.length === 1) {
    return 'http://eslint.org/docs/rules/' + ruleId;
  }

  var pluginName = ruleParts[0];
  var ruleName = ruleParts[1];
  switch (pluginName) {
    case 'angular':
      return 'https://github.com/Gillespie59/eslint-plugin-angular/blob/master/docs/' + ruleName + '.md';

    case 'ava':
      return 'https://github.com/sindresorhus/eslint-plugin-ava/blob/master/docs/rules/' + ruleName + '.md';

    case 'import':
      return 'https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/' + ruleName + '.md';

    case 'import-order':
      return 'https://github.com/jfmengels/eslint-plugin-import-order/blob/master/docs/rules/' + ruleName + '.md';

    case 'jasmine':
      return 'https://github.com/tlvince/eslint-plugin-jasmine/blob/master/docs/rules/' + ruleName + '.md';

    case 'jsx-a11y':
      return 'https://github.com/evcohen/eslint-plugin-jsx-a11y/blob/master/docs/rules/' + ruleName + '.md';

    case 'lodash':
      return 'https://github.com/wix/eslint-plugin-lodash/blob/master/docs/rules/' + ruleName + '.md';

    case 'mocha':
      return 'https://github.com/lo1tuma/eslint-plugin-mocha/blob/master/docs/rules/' + ruleName + '.md';

    case 'promise':
      return 'https://github.com/xjamundx/eslint-plugin-promise#' + ruleName;

    case 'react':
      return 'https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/' + ruleName + '.md';

    default:
      return 'https://github.com/AtomLinter/linter-eslint/wiki/Linking-to-Rule-Documentation';
  }
}
