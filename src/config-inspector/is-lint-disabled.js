'use babel'

import { getConfigPath } from '../file-system'
import isAtHomeRoot from './is-at-home-root'

// eslint-disable-next-line import/prefer-default-export
const isLintDisabled = ({ fileDir, disableWhenNoEslintConfig }) => {
  const configPath = getConfigPath(fileDir)
  const noProjectConfig = (
    configPath === null
    || isAtHomeRoot(configPath)
  )
  return noProjectConfig && disableWhenNoEslintConfig
}

export default isLintDisabled
