'use strict';
'use babel';

// Note: 'use babel' doesn't work in forked processes

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _processCommunication = require('process-communication');

var _atomLinter = require('atom-linter');

var _workerHelpers = require('./worker-helpers');

var Helpers = _interopRequireWildcard(_workerHelpers);

var _isConfigAtHomeRoot = require('./is-config-at-home-root');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

process.title = 'linter-eslint helper';

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
      contents = _ref2.contents,
      eslint = _ref2.eslint,
      filePath = _ref2.filePath;

  const report = lintJob({ cliEngineOptions, contents, eslint, filePath });

  eslint.CLIEngine.outputFixes(report);

  if (!report.results.length || !report.results[0].messages.length) {
    return 'Linter-ESLint: Fix complete.';
  }
  return 'Linter-ESLint: Fix attempt complete, but linting errors remain.';
}

(0, _processCommunication.create)().onRequest('job', (_ref3, job) => {
  let contents = _ref3.contents,
      type = _ref3.type,
      config = _ref3.config,
      filePath = _ref3.filePath,
      projectPath = _ref3.projectPath,
      rules = _ref3.rules;

  if (config.disableFSCache) {
    _atomLinter.FindCache.clear();
  }

  const fileDir = _path2.default.dirname(filePath);
  const eslint = Helpers.getESLintInstance(fileDir, config, projectPath);
  const configPath = Helpers.getConfigPath(fileDir);
  const relativeFilePath = Helpers.getRelativePath(fileDir, filePath, config);

  const cliEngineOptions = Helpers.getCLIEngineOptions(type, config, rules, relativeFilePath, fileDir, configPath);

  const noProjectConfig = configPath === null || (0, _isConfigAtHomeRoot.isConfigAtHomeRoot)(configPath);
  if (noProjectConfig && config.disableWhenNoEslintConfig) {
    job.response = [];
  } else if (type === 'lint') {
    const report = lintJob({ cliEngineOptions, contents, eslint, filePath });
    job.response = report.results.length ? report.results[0].messages : [];
  } else if (type === 'fix') {
    job.response = fixJob({ cliEngineOptions, contents, eslint, filePath });
  } else if (type === 'debug') {
    const modulesDir = _path2.default.dirname((0, _atomLinter.findCached)(fileDir, 'node_modules/eslint') || '');
    job.response = Helpers.findESLintDirectory(modulesDir, config);
  }
});