'use babel'

/* eslint-disable no-param-reassign */
const setValue = (config, rule) => (value) => {
  config[rule] = value
  return config
}

export default setValue
