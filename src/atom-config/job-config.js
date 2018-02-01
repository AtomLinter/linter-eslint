'use babel'

import rPick from 'ramda/src/pick'
import { atomConfig } from './'

const jobConfig = () => rPick([
  'disableFSCache',
  'disableWhenNoEslintConfig',
  'useGlobalEslint',
  'globalNodePath',
  'advancedLocalNodeModules',
  'disableEslintIgnore',
  'eslintRulesDirs',
  'eslintrcPath'
], atomConfig)

export default jobConfig
