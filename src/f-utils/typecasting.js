'use babel'

/** *********************************
 * Cast or transform between types *
 ********************************** */

const fromPairs = require('ramda/src/fromPairs')
const toPairs = require('ramda/src/toPairs')

// fromMapToObj :: Map a -> Object a
const fromMapToObj = m => fromPairs([...m])

// fromObjToMap :: Object a -> Map a
const fromObjToMap = o => new Map(toPairs(o))

module.exports = {
  fromMapToObj,
  fromObjToMap
}
