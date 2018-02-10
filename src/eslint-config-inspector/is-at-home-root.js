
const userHome = require('user-home')
const { dirname } = require('path')

/**
 * Check if a config is directly inside a user's home directory.
 * Such config files are used by ESLint as a fallback, only for situations
 * when there is no other config file between a file being linted and root.
 *
 * @param  {string}  configPath - The path of the config file being checked
 * @return {Boolean}              True if the file is directly in the current user's home
 */
const isConfigAtHomeRoot = configPath => dirname(configPath) === userHome

module.exports = isConfigAtHomeRoot
