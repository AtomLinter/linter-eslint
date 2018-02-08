'use babel'

import { toIgnored } from '../../rules'

const setIgnoredFixes = config => (array) => {
  // eslint-disable-next-line no-param-reassign
  config.ignoredRulesWhenFixing = toIgnored(array)
  return config
}

export default setIgnoredFixes
