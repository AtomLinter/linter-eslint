'use babel'

import { idsToIgnoredRules } from '../../rules'

/* eslint-disable no-param-reassign */

const setIgnoredFixes = config => (array) => {
  config.ignoredRulesWhenFixing = idsToIgnoredRules(array)
  return config
}

export default setIgnoredFixes
