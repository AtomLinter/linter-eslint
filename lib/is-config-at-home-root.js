'use strict';

var _userHome = require('user-home');

var _userHome2 = _interopRequireDefault(_userHome);

var _path = require('path');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Check if a config is directly inside a user's home directory.
 * Such config files are used by ESLint as a fallback, only for situations
 * when there is no other config file between a file being linted and root.
 *
 * @param  {string}  configPath - The path of the config file being checked
 * @return {Boolean}              True if the file is directly in the current user's home
 */
/* eslint-disable import/prefer-default-export */

module.exports = function isConfigAtHomeRoot(configPath) {
  return (0, _path.dirname)(configPath) === _userHome2.default;
};