
const { toIgnored } = require('../../rules')

const setIgnoredFixes = config => (array) => {
  // eslint-disable-next-line no-param-reassign
  config.ignoredRulesWhenFixing = toIgnored(array)
  return config
}

module.exports = setIgnoredFixes
