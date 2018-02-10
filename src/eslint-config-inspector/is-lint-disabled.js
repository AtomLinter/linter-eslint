
const { getConfigPath } = require('../file-system')
const isAtHomeRoot = require('./is-at-home-root')

const isLintDisabled = ({ fileDir, disableWhenNoEslintConfig }) => {
  const configPath = getConfigPath(fileDir)
  const noProjectConfig = (
    configPath === null
    || isAtHomeRoot(configPath)
  )
  return noProjectConfig && disableWhenNoEslintConfig
}

module.exports = isLintDisabled
