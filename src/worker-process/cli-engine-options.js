'use babel'

import { isAbsolute as isAbsolutePath } from 'path'
import { findCached } from 'atom-linter'
import { cleanPath, getConfigPath, getIgnoreFile } from '../file-system'

const getCLIEngineOptions = ({
  jobType,
  rules,
  fileDir,
  disableEslintIgnore,
  eslintRulesDirs,
  eslintrcPath
}) => {
  const cliEngineConfig = {
    rules,
    ignore: !disableEslintIgnore,
    fix: jobType === 'fix'
  }

  const ignoreFile = getIgnoreFile({ disableEslintIgnore, fileDir })
  if (ignoreFile) {
    cliEngineConfig.ignorePath = ignoreFile
  }

  cliEngineConfig.rulePaths = eslintRulesDirs.map((path) => {
    const rulesDir = cleanPath(path)
    if (!isAbsolutePath(rulesDir)) {
      return findCached(fileDir, rulesDir)
    }
    return rulesDir
  }).filter(path => path)

  if (getConfigPath(fileDir) === null && eslintrcPath) {
    // If we didn't find a configuration use the fallback from the settings
    cliEngineConfig.configFile = cleanPath(eslintrcPath)
  }

  return cliEngineConfig
}

export default getCLIEngineOptions
