'use babel'

import { fromIdsToIgnored } from '../../rules'

const setIgnoredFixes = config => (array) => {
  // eslint-disable-next-line no-param-reassign
  config.ignoredRulesWhenFixing = fromIdsToIgnored(array)
  return config
}

export default setIgnoredFixes
