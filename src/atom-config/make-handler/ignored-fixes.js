'use babel'

import { idsToIgnoredRules } from '../../rules'

const setIgnoredFixes = config => (array) => {
  // eslint-disable-next-line no-param-reassign
  config.ignoredRulesWhenFixing = idsToIgnoredRules(array)
  return config
}

export default setIgnoredFixes
