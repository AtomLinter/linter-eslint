'use strict';
'use babel';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getNodePrefixPath = getNodePrefixPath;
exports.getESLintFromDirectory = getESLintFromDirectory;
exports.refreshModulesPath = refreshModulesPath;
exports.getESLintInstance = getESLintInstance;
exports.getConfigPath = getConfigPath;
exports.getRelativePath = getRelativePath;
exports.getArgv = getArgv;

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

var _resolveEnv = require('resolve-env');

var _resolveEnv2 = _interopRequireDefault(_resolveEnv);

var _atomLinter = require('atom-linter');

var _consistentPath = require('consistent-path');

var _consistentPath2 = _interopRequireDefault(_consistentPath);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Cache = {
  ESLINT_LOCAL_PATH: _path2.default.normalize(_path2.default.join(__dirname, '..', 'node_modules', 'eslint')),
  NODE_PREFIX_PATH: null,
  LAST_MODULES_PATH: null
};

function getNodePrefixPath() {
  if (Cache.NODE_PREFIX_PATH === null) {
    var npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    try {
      Cache.NODE_PREFIX_PATH = _child_process2.default.spawnSync(npmCommand, ['get', 'prefix'], {
        env: Object.assign(Object.assign({}, process.env), { PATH: (0, _consistentPath2.default)() })
      }).output[1].toString().trim();
    } catch (e) {
      throw new Error('Unable to execute `npm get prefix`. Please make sure Atom is getting $PATH correctly');
    }
  }
  return Cache.NODE_PREFIX_PATH;
}

function getESLintFromDirectory(modulesDir, config) {
  var ESLintDirectory = null;

  if (config.useGlobalEslint) {
    var prefixPath = config.globalNodePath || getNodePrefixPath();
    if (process.platform === 'win32') {
      ESLintDirectory = _path2.default.join(prefixPath, 'node_modules', 'eslint');
    } else {
      ESLintDirectory = _path2.default.join(prefixPath, 'lib', 'node_modules', 'eslint');
    }
  } else {
    ESLintDirectory = _path2.default.join(modulesDir || '', 'eslint');
  }
  try {
    return require(_path2.default.join(ESLintDirectory, 'lib', 'cli.js'));
  } catch (e) {
    if (config.useGlobalEslint && e.code === 'MODULE_NOT_FOUND') {
      throw new Error('ESLint not found, Please install or make sure Atom is getting $PATH correctly');
    }
    return require(_path2.default.join(Cache.ESLINT_LOCAL_PATH, 'lib', 'cli.js'));
  }
}

function refreshModulesPath(modulesDir) {
  if (Cache.LAST_MODULES_PATH !== modulesDir) {
    Cache.LAST_MODULES_PATH = modulesDir;
    process.env.NODE_PATH = modulesDir || '';
    require('module').Module._initPaths();
  }
}

function getESLintInstance(fileDir, config) {
  var modulesDir = _path2.default.dirname((0, _atomLinter.findCached)(fileDir, 'node_modules/eslint') || '');
  refreshModulesPath(modulesDir);
  return getESLintFromDirectory(modulesDir, config);
}

function getConfigPath(fileDir) {
  var configFile = (0, _atomLinter.findCached)(fileDir, ['.eslintrc.js', '.eslintrc.yaml', '.eslintrc.yml', '.eslintrc.json', '.eslintrc']);
  if (configFile) {
    return configFile;
  }

  var packagePath = (0, _atomLinter.findCached)(fileDir, 'package.json');
  if (packagePath && Boolean(require(packagePath).eslintConfig)) {
    return packagePath;
  }
  return null;
}

function getRelativePath(fileDir, filePath, config) {
  var ignoreFile = config.disableEslintIgnore ? null : (0, _atomLinter.findCached)(fileDir, '.eslintignore');

  if (ignoreFile) {
    var ignoreDir = _path2.default.dirname(ignoreFile);
    process.chdir(ignoreDir);
    return _path2.default.relative(ignoreDir, filePath);
  }
  process.chdir(fileDir);
  return _path2.default.basename(filePath);
}

function getArgv(type, config, filePath, fileDir, givenConfigPath) {
  var configPath = void 0;
  if (givenConfigPath === null) {
    configPath = config.eslintrcPath || null;
  } else configPath = givenConfigPath;

  var argv = [process.execPath, 'a-b-c' // dummy value for eslint executable
  ];
  if (type === 'lint') {
    argv.push('--stdin');
  }
  argv.push('--format', _path2.default.join(__dirname, 'reporter.js'));

  var ignoreFile = config.disableEslintIgnore ? null : (0, _atomLinter.findCached)(fileDir, '.eslintignore');
  if (ignoreFile) {
    argv.push('--ignore-path', ignoreFile);
  }

  if (config.eslintRulesDir) {
    var rulesDir = (0, _resolveEnv2.default)(config.eslintRulesDir);
    if (!_path2.default.isAbsolute(rulesDir)) {
      rulesDir = (0, _atomLinter.findCached)(fileDir, rulesDir);
    }
    argv.push('--rulesdir', rulesDir);
  }
  if (configPath) {
    argv.push('--config', (0, _resolveEnv2.default)(configPath));
  }
  if (config.disableEslintIgnore) {
    argv.push('--no-ignore');
  }
  if (type === 'lint') {
    argv.push('--stdin-filename', filePath);
  } else if (type === 'fix') {
    argv.push(filePath);
    argv.push('--fix');
  }

  return argv;
}
