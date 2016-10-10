'use strict';
'use babel';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.spawnWorker = spawnWorker;
exports.showError = showError;
exports.idsToIgnoredRules = idsToIgnoredRules;
exports.validatePoint = validatePoint;

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

var _processCommunication = require('process-communication');

var _path = require('path');

var _atom = require('atom');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var RULE_OFF_SEVERITY = 0;

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
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
