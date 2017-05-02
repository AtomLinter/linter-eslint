'use strict';
'use babel';

/* global emit */

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _atomLinter = require('atom-linter');

var _workerHelpers = require('./worker-helpers');

var Helpers = _interopRequireWildcard(_workerHelpers);

var _isConfigAtHomeRoot = require('./is-config-at-home-root');

var _isConfigAtHomeRoot2 = _interopRequireDefault(_isConfigAtHomeRoot);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

process.title = 'linter-eslint helper';

const ignoredMessages = [
// V1
'File ignored because of your .eslintignore file. Use --no-ignore to override.',
// V2
'File ignored because of a matching ignore pattern. Use --no-ignore to override.',
// V2.11.1
'File ignored because of a matching ignore pattern. Use "--no-ignore" to override.',
// supress warning that the current file is ignored by eslint by default
'File ignored by default.  Use a negated ignore pattern (like "--ignore-pattern \'!<relative' + '/path/to/filename>\'") to override.', 'File ignored by default. Use "--ignore-pattern \'!node_modules/*\'" to override.', 'File ignored by default. Use "--ignore-pattern \'!bower_components/*\'" to override.'];

function shouldBeReported(problem) {
  return !ignoredMessages.includes(problem.message);
}

function lintJob(_ref) {
  let cliEngineOptions = _ref.cliEngineOptions,
      contents = _ref.contents,
      eslint = _ref.eslint,
      filePath = _ref.filePath;

  const cliEngine = new eslint.CLIEngine(cliEngineOptions);

  return typeof contents === 'string' ? cliEngine.executeOnText(contents, filePath) : cliEngine.executeOnFiles([filePath]);
}

function fixJob(_ref2) {
  let cliEngineOptions = _ref2.cliEngineOptions,
      eslint = _ref2.eslint,
      filePath = _ref2.filePath;

  const report = lintJob({ cliEngineOptions, eslint, filePath });

  eslint.CLIEngine.outputFixes(report);

  if (!report.results.length || !report.results[0].messages.filter(shouldBeReported).length) {
    return 'Linter-ESLint: Fix complete.';
  }
  return 'Linter-ESLint: Fix attempt complete, but linting errors remain.';
}

module.exports = _asyncToGenerator(function* () {
  process.on('message', function (jobConfig) {
    const contents = jobConfig.contents,
          type = jobConfig.type,
          config = jobConfig.config,
          filePath = jobConfig.filePath,
          projectPath = jobConfig.projectPath,
          rules = jobConfig.rules,
          emitKey = jobConfig.emitKey;

    if (config.disableFSCache) {
      _atomLinter.FindCache.clear();
    }

    const fileDir = _path2.default.dirname(filePath);
    const eslint = Helpers.getESLintInstance(fileDir, config, projectPath);
    const configPath = Helpers.getConfigPath(fileDir);
    const noProjectConfig = configPath === null || (0, _isConfigAtHomeRoot2.default)(configPath);
    if (noProjectConfig && config.disableWhenNoEslintConfig) {
      emit(emitKey, []);
      return;
    }

    const relativeFilePath = Helpers.getRelativePath(fileDir, filePath, config);

    const cliEngineOptions = Helpers.getCLIEngineOptions(type, config, rules, relativeFilePath, fileDir, configPath);

    let response;
    if (type === 'lint') {
      const report = lintJob({ cliEngineOptions, contents, eslint, filePath });
      response = report.results.length ? report.results[0].messages.filter(shouldBeReported) : [];
    } else if (type === 'fix') {
      response = fixJob({ cliEngineOptions, eslint, filePath });
    } else if (type === 'debug') {
      const modulesDir = _path2.default.dirname((0, _atomLinter.findCached)(fileDir, 'node_modules/eslint') || '');
      response = Helpers.findESLintDirectory(modulesDir, config);
    }
    emit(emitKey, response);
  });
});