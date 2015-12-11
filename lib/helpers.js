'use strict';
'use babel';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.find = undefined;
exports.spawnWorker = spawnWorker;
exports.findEslintDir = findEslintDir;
exports.determineConfigFile = determineConfigFile;
exports.getEslintCli = getEslintCli;

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

var _childprocessPromise = require('childprocess-promise');

var _childprocessPromise2 = _interopRequireDefault(_childprocessPromise);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

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

let prefixPath = null;
const atomEslintPath = _path2.default.normalize(_path2.default.join(__dirname, '..', 'node_modules', 'eslint'));

function findEslintDir(params) {
  const modulesPath = (0, _atomLinter.find)(params.fileDir, 'node_modules');
  let eslintNewPath = null;

  if (params.global) {
    if (params.nodePath === '' && prefixPath === null) {
      const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      try {
        prefixPath = _child_process2.default.spawnSync(npmCommand, ['get', 'prefix']).output[1].toString().trim();
      } catch (e) {
        throw new Error('Unable to execute `npm get prefix`. Please make sure Atom is getting $PATH correctly');
      }
    }
    if (process.platform === 'win32') {
      eslintNewPath = _path2.default.join(params.nodePath || prefixPath, 'node_modules', 'eslint');
    } else {
      eslintNewPath = _path2.default.join(params.nodePath || prefixPath, 'lib', 'node_modules', 'eslint');
    }
  } else {
    try {
      _fs2.default.accessSync(eslintNewPath = _path2.default.join(modulesPath, 'eslint'), _fs2.default.R_OK);
    } catch (_) {
      eslintNewPath = atomEslintPath;
    }
  }

  return eslintNewPath;
}

// Check for project config file or eslint config in package.json and determine
// whether to bail out or use config specified in package options
function determineConfigFile(params) {
  // config file
  const configFile = (0, _atomLinter.find)(params.fileDir, ['.eslintrc.js', '.eslintrc.yaml', '.eslintrc.yml', '.eslintrc.json', '.eslintrc']) || null;
  if (configFile) {
    return configFile;
  }
  // package.json
  const packagePath = (0, _atomLinter.find)(params.fileDir, 'package.json');
  if (packagePath && Boolean(require(packagePath).eslintConfig)) {
    return packagePath;
  }
  // Couldn't find a config
  if (params.canDisable) {
    return null;
  }
  // If all else fails, use the configFile specified in the linter-eslint options
  if (params.configFile) {
    return params.configFile;
  }
}

function getEslintCli(path) {
  try {
    const eslint = require(_path2.default.join(path, 'lib', 'cli.js'));
    return eslint;
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      throw new Error('ESLint not found, Please install or make sure Atom is getting $PATH correctly');
    } else throw e;
  }
}

exports.find = _atomLinter.find;