'use strict';
'use babel';

// Note: 'use babel' doesn't work in forked processes

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _processCommunication = require('process-communication');

var _atomLinter = require('atom-linter');

var _workerHelpers = require('./worker-helpers');

var Helpers = _interopRequireWildcard(_workerHelpers);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

process.title = 'linter-eslint helper';

var ignoredMessages = [
// V1
'File ignored because of your .eslintignore file. Use --no-ignore to override.',
// V2
'File ignored because of a matching ignore pattern. Use --no-ignore to override.',
// V2.11.1
'File ignored because of a matching ignore pattern. Use "--no-ignore" to override.',
// supress warning that the current file is ignored by eslint by default
'File ignored by default.  Use a negated ignore pattern (like "--ignore-pattern \'!<relative' + '/path/to/filename>\'") to override.', 'File ignored by default. Use "--ignore-pattern \'!node_modules/*\'" to override.', 'File ignored by default. Use "--ignore-pattern \'!bower_components/*\'" to override.'];

function lintJob(argv, contents, eslint, configPath, config) {
  if (configPath === null && config.disableWhenNoEslintConfig) {
    return [];
  }
  eslint.execute(argv, contents);
  return global.__LINTER_ESLINT_RESPONSE.filter(function (e) {
    return !ignoredMessages.includes(e.message);
  });
}

function fixJob(argv, eslint) {
  try {
    eslint.execute(argv);
    return 'Linter-ESLint: Fix Complete';
  } catch (err) {
    throw new Error('Linter-ESLint: Fix Attempt Completed, Linting Errors Remain');
  }
}

(0, _processCommunication.create)().onRequest('job', function (_ref, job) {
  var contents = _ref.contents;
  var type = _ref.type;
  var config = _ref.config;
  var filePath = _ref.filePath;
  var projectPath = _ref.projectPath;
  var rules = _ref.rules;

  global.__LINTER_ESLINT_RESPONSE = [];

  if (config.disableFSCache) {
    _atomLinter.FindCache.clear();
  }

  var fileDir = _path2.default.dirname(filePath);
  var eslint = Helpers.getESLintInstance(fileDir, config, projectPath);
  var configPath = Helpers.getConfigPath(fileDir);
  var relativeFilePath = Helpers.getRelativePath(fileDir, filePath, config);

  var argv = Helpers.getArgv(type, config, rules, relativeFilePath, fileDir, configPath);

  if (type === 'lint') {
    job.response = lintJob(argv, contents, eslint, configPath, config);
  } else if (type === 'fix') {
    job.response = fixJob(argv, eslint);
  } else if (type === 'debug') {
    var modulesDir = _path2.default.dirname((0, _atomLinter.findCached)(fileDir, 'node_modules/eslint') || '');
    job.response = Helpers.findESLintDirectory(modulesDir, config);
  }
});

process.exit = function () {/* Stop eslint from closing the daemon */};
