'use babel'

const setValue = (config, rule) => (value) => {
  // eslint-disable-next-line no-param-reassign
  config[rule] = value
  return config
}

export default setValue
