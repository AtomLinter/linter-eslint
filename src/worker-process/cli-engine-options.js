
const { isAbsolute: isAbsolutePath } = require('path')
const { findCached } = require('atom-linter')
const { cleanPath, getConfigPath, getIgnoreFile } = require('../file-system')

const getCLIEngineOptions = ({
  type,
  rules,
  fileDir,
  disableEslintIgnore,
  eslintRulesDirs,
  eslintrcPath
}) => {
  const cliEngineConfig = {
    rules,
    ignore: !disableEslintIgnore,
    fix: type === 'fix'
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

module.exports = getCLIEngineOptions
