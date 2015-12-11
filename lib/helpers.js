'use strict';
'use babel';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.spawnWorker = spawnWorker;

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

var _childprocessPromise = require('childprocess-promise');

var _childprocessPromise2 = _interopRequireDefault(_childprocessPromise);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function spawnWorker() {
  let shouldLive = true;
  const env = Object.create(process.env);
  delete env.NODE_PATH;
  delete env.NODE_ENV;
  const data = { stdout: [], stderr: [] };
  const child = _child_process2.default.fork(__dirname + '/worker.js', [], { env: env, silent: true });
  const worker = new _childprocessPromise2.default(child);
  function killer() {
    shouldLive = false;
    child.kill();
  }
  child.stdout.on('data', function (chunk) {
    data.stdout.push(chunk);
  });
  child.stderr.on('data', function (chunk) {
    data.stderr.push(chunk);
  });
  child.on('exit', function () {
    if (shouldLive) {
      console.log('ESLint Worker Info', { stdout: data.stdout.join(''), stderr: data.stderr.join('') });
      atom.notifications.addWarning('[Linter-ESLint] Worker died unexpectedly', { detail: 'Check your console for more info. A new worker will be spawned instantly.', dismissable: true });
    }
    child.emit('exit-linter', shouldLive);
  });
  process.on('exit', killer);
  return { child: child, worker: worker, subscription: { dispose: function () {
        killer();
        process.removeListener('exit', killer);
      } } };
}
