'use strict';
'use babel';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getNodePrefixPath = getNodePrefixPath;
exports.findESLintDirectory = findESLintDirectory;
exports.getESLintFromDirectory = getESLintFromDirectory;
exports.refreshModulesPath = refreshModulesPath;
exports.getESLintInstance = getESLintInstance;
exports.getConfigPath = getConfigPath;
exports.getRelativePath = getRelativePath;
exports.getCLIEngineOptions = getCLIEngineOptions;

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

var _resolveEnv = require('resolve-env');

var _resolveEnv2 = _interopRequireDefault(_resolveEnv);

var _atomLinter = require('atom-linter');

var _consistentPath = require('consistent-path');

var _consistentPath2 = _interopRequireDefault(_consistentPath);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const Cache = {
  ESLINT_LOCAL_PATH: _path2.default.normalize(_path2.default.join(__dirname, '..', 'node_modules', 'eslint')),
  NODE_PREFIX_PATH: null,
  LAST_MODULES_PATH: null
};

function getNodePrefixPath() {
  if (Cache.NODE_PREFIX_PATH === null) {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
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

function findESLintDirectory(modulesDir, config, projectPath) {
  let eslintDir = null;
  let locationType = null;
  if (config.useGlobalEslint) {
    locationType = 'global';
    const prefixPath = config.globalNodePath || getNodePrefixPath();
    if (process.platform === 'win32') {
      eslintDir = _path2.default.join(prefixPath, 'node_modules', 'eslint');
    } else {
      eslintDir = _path2.default.join(prefixPath, 'lib', 'node_modules', 'eslint');
    }
  } else if (!config.advancedLocalNodeModules) {
    locationType = 'local project';
    eslintDir = _path2.default.join(modulesDir || '', 'eslint');
  } else {
    config.advancedLocalNodeModules.split(',').some(localNodeModulePath => {
      if (_path2.default.isAbsolute(localNodeModulePath)) {
        locationType = 'advanced specified';
        eslintDir = _path2.default.join(localNodeModulePath || '', 'eslint');
      } else {
        locationType = 'advanced specified';
        eslintDir = _path2.default.join(projectPath, localNodeModulePath, 'eslint');
      }
      return _fs2.default.existsSync(eslintDir);
    });
  }
  try {
    if (_fs2.default.statSync(eslintDir).isDirectory()) {
      return {
        path: eslintDir,
        type: locationType
      };
    }
  } catch (e) {
    if (config.useGlobalEslint && e.code === 'ENOENT') {
      throw new Error('ESLint not found, Please install or make sure Atom is getting $PATH correctly');
    }
  }
  return {
    path: Cache.ESLINT_LOCAL_PATH,
    type: 'bundled fallback'
  };
}

function getESLintFromDirectory(modulesDir, config, projectPath) {
  var _findESLintDirectory = findESLintDirectory(modulesDir, config, projectPath);

  const ESLintDirectory = _findESLintDirectory.path;

  try {
    // eslint-disable-next-line import/no-dynamic-require
    return require(ESLintDirectory);
  } catch (e) {
    if (config.useGlobalEslint && e.code === 'MODULE_NOT_FOUND') {
      throw new Error('ESLint not found, Please install or make sure Atom is getting $PATH correctly');
    }
    // eslint-disable-next-line import/no-dynamic-require
    return require(Cache.ESLINT_LOCAL_PATH);
  }
}

function refreshModulesPath(modulesDir) {
  if (Cache.LAST_MODULES_PATH !== modulesDir) {
    Cache.LAST_MODULES_PATH = modulesDir;
    process.env.NODE_PATH = modulesDir || '';
    require('module').Module._initPaths();
  }
}

function getESLintInstance(fileDir, config, projectPath) {
  const modulesDir = _path2.default.dirname((0, _atomLinter.findCached)(fileDir, 'node_modules/eslint') || '');
  refreshModulesPath(modulesDir);
  return getESLintFromDirectory(modulesDir, config, projectPath || '');
}

function getConfigPath(fileDir) {
  const configFile = (0, _atomLinter.findCached)(fileDir, ['.eslintrc.js', '.eslintrc.yaml', '.eslintrc.yml', '.eslintrc.json', '.eslintrc', 'package.json']);
  if (configFile) {
    if (_path2.default.basename(configFile) === 'package.json') {
      // eslint-disable-next-line import/no-dynamic-require
      if (require(configFile).eslintConfig) {
        return configFile;
      }
      // If we are here, we found a package.json without an eslint config
      // in a dir without any other eslint config files
      // (because 'package.json' is last in the call to findCached)
      // So, keep looking from the parent directory
      return getConfigPath(_path2.default.resolve(_path2.default.dirname(configFile), '..'));
    }
    return configFile;
  }
  return null;
}

function getRelativePath(fileDir, filePath, config) {
  const ignoreFile = config.disableEslintIgnore ? null : (0, _atomLinter.findCached)(fileDir, '.eslintignore');

  if (ignoreFile) {
    const ignoreDir = _path2.default.dirname(ignoreFile);
    process.chdir(ignoreDir);
    return _path2.default.relative(ignoreDir, filePath);
  }
  process.chdir(fileDir);
  return _path2.default.basename(filePath);
}

function getCLIEngineOptions(type, config, rules, filePath, fileDir, givenConfigPath) {
  const cliEngineConfig = {
    rules,
    ignore: !config.disableEslintIgnore,
    fix: type === 'fix'
  };

  const ignoreFile = config.disableEslintIgnore ? null : (0, _atomLinter.findCached)(fileDir, '.eslintignore');
  if (ignoreFile) {
    cliEngineConfig.ignorePath = ignoreFile;
  }

  if (config.eslintRulesDir) {
    let rulesDir = (0, _resolveEnv2.default)(config.eslintRulesDir);
    if (!_path2.default.isAbsolute(rulesDir)) {
      rulesDir = (0, _atomLinter.findCached)(fileDir, rulesDir);
    }
    if (rulesDir) {
      cliEngineConfig.rulePaths = [rulesDir];
    }
  }

  if (givenConfigPath === null && config.eslintrcPath) {
    // If we didn't find a configuration use the fallback from the settings
    cliEngineConfig.configFile = (0, _resolveEnv2.default)(config.eslintrcPath);
  }

  return cliEngineConfig;
}