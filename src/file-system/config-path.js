'use babel'

import { basename, resolve, dirname } from 'path'
import { findCached } from 'atom-linter'

const getConfigPath = (fileDir) => {
  const configFile =
    findCached(fileDir, [
      '.eslintrc.js',
      '.eslintrc.yaml',
      '.eslintrc.yml',
      '.eslintrc.json',
      '.eslintrc',
      'package.json'
    ])
  if (configFile) {
    if (basename(configFile) === 'package.json') {
      // eslint-disable-next-line import/no-dynamic-require
      if (require(configFile).eslintConfig) {
        return configFile
      }
      // If we are here, we found a package.json without an eslint config
      // in a dir without any other eslint config files
      // (because 'package.json' is last in the call to findCached)
      // So, keep looking from the parent directory
      return getConfigPath(resolve(dirname(configFile), '..'))
    }
    return configFile
  }
  return null
}

export default getConfigPath
