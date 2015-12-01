'use strict';
'use babel';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.spawnWorker = spawnWorker;
exports.getModulesDirectory = getModulesDirectory;
exports.getIgnoresFile = getIgnoresFile;
exports.getEslintFromDirectory = getEslintFromDirectory;
exports.getNodePrefixPath = getNodePrefixPath;
exports.getBundledEslintDirectory = getBundledEslintDirectory;
exports.getEslintDirectory = getEslintDirectory;
exports.getEslintConfig = getEslintConfig;
exports.getEslint = getEslint;

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

var _childprocessPromise = require('childprocess-promise');

var _childprocessPromise2 = _interopRequireDefault(_childprocessPromise);

var _atomLinter = require('atom-linter');

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

function getModulesDirectory(fileDir) {
  return (0, _atomLinter.findFile)(fileDir, 'node_modules');
}

function getIgnoresFile(fileDir) {
  return _path2.default.dirname((0, _atomLinter.findFile)(fileDir, '.eslintignore'));
}

function getEslintFromDirectory(path) {
  try {
    return require(_path2.default.join(path, 'lib', 'cli.js'));
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      throw new Error('ESLint not found, Please install or make sure Atom is getting $PATH correctly');
    } else throw e;
  }
}

let nodePrefixPath = null;

function getNodePrefixPath() {
  if (nodePrefixPath === null) {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    try {
      nodePrefixPath = _child_process2.default.spawnSync(npmCommand, ['get', 'prefix']).output[1].toString().trim();
    } catch (e) {
      throw new Error('Unable to execute `npm get prefix`. Please make sure Atom is getting $PATH correctly');
    }
  }
  return nodePrefixPath;
}

let bundledEslintDirectory = null;

function getBundledEslintDirectory() {
  if (bundledEslintDirectory === null) {
    bundledEslintDirectory = _path2.default.normalize(_path2.default.join(__dirname, '..', 'node_modules', 'eslint'));
  }
  return bundledEslintDirectory;
}

function getEslintDirectory(params) {
  let modulesPath = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

  if (params.global) {
    const prefixPath = getNodePrefixPath();
    if (process.platform === 'win32') {
      return _path2.default.join(params.nodePath || prefixPath, 'node_modules', 'eslint');
    } else {
      return _path2.default.join(params.nodePath || prefixPath, 'lib', 'node_modules', 'eslint');
    }
  } else {
    const eslintPath = _path2.default.join(modulesPath || getModulesDirectory(params.fileDir), 'eslint');
    try {
      _fs2.default.accessSync(eslintPath, _fs2.default.R_OK);
      return eslintPath;
    } catch (_) {
      return getBundledEslintDirectory();
    }
  }
}

function getEslintConfig(params) {
  const configFile = (0, _atomLinter.findFile)(params.fileDir, ['.eslintrc.js', '.eslintrc.yaml', '.eslintrc.yml', '.eslintrc.json', '.eslintrc']) || null;
  if (configFile) {
    return configFile;
  }

  const packagePath = (0, _atomLinter.findFile)(params.fileDir, 'package.json');
  if (packagePath && Boolean(require(packagePath).eslintConfig)) {
    return packagePath;
  }

  if (params.canDisable) {
    return null;
  }

  if (params.configFile) {
    return params.configFile;
  }
}

let eslint;
let lastEslintDirectory;
let lastModulesPath;

function getEslint(params) {
  const modulesPath = getModulesDirectory(params.fileDir);
  const eslintDirectory = getEslintDirectory(params, modulesPath);
  if (eslintDirectory !== lastEslintDirectory) {
    lastEslintDirectory = eslintDirectory;
    eslint = getEslintFromDirectory(eslintDirectory);
  }
  if (lastModulesPath !== modulesPath) {
    lastModulesPath = modulesPath;
    if (modulesPath) {
      process.env.NODE_PATH = modulesPath;
    } else process.env.NODE_PATH = '';
    require('module').Module._initPaths();
  }
  return { eslint: eslint, eslintDirectory: eslintDirectory };
}