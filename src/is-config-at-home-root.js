'use babel'

/* eslint-disable import/prefer-default-export */

import userHome from 'user-home'
import { dirname } from 'path'

/**
 * Check if a config is directly inside a user's home directory.
 * Such config files are used by ESLint as a fallback, only for situations
 * when there is no other config file between a file being linted and root.
 *
 * @param  {string}  configPath - The path of the config file being checked
 * @return {Boolean}              True if the file is directly in the current user's home
 */
module.exports = function isConfigAtHomeRoot(configPath) {
  return (dirname(configPath) === userHome)
}
