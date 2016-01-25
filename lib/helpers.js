'use strict';
'use babel';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.spawnWorker = spawnWorker;
exports.showError = showError;

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

var _atom = require('atom');

var _processCommunication = require('process-communication');

var _path = require('path');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function spawnWorker() {
  const env = Object.create(process.env);

  delete env.NODE_PATH;
  delete env.NODE_ENV;
  delete env.OS;

  const child = _child_process2.default.fork((0, _path.join)(__dirname, 'worker.js'), [], { env: env, silent: true });
  const worker = (0, _processCommunication.createFromProcess)(child);

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
  let givenDetail = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

  let detail;
  let message;
  if (message instanceof Error) {
    detail = message.stack;
    message = message.message;
  } else {
    detail = givenDetail;
    message = givenMessage;
  }
  atom.notifications.addError(`[Linter-ESLint] ${ message }`, {
    detail: detail,
    dismissable: true
  });
}
