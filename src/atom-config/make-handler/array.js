'use babel'

import { replaceArrayInPlace } from '../../m-utils'

const setArray = (config, rule) => (array) => {
  replaceArrayInPlace(config[rule], array)
  return config
}

export default setArray
