
const setValue = (config, rule) => (value) => {
  // eslint-disable-next-line no-param-reassign
  config[rule] = value
  return config
}

module.exports = setValue
