'use strict';
'use babel';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.generateDebugString = exports.getDebugInfo = undefined;

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
