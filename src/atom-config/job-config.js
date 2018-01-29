'use babel'

// This is parsed in main script *before* idleCallbacks,
// So import *only* the pick function from ramda.
//
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
