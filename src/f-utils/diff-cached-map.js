
const diffMapDeep = require('./diff-map-deep')

// Compares a Map to the Map provided by the previous
// call to this function using. Returns a Diff Object and
// overwrites previous cache with current Map.
//
const makeDiffCachedMap = diffMap => (oldMap = new Map()) =>
  (newMap) => {
    const diff = diffMap(oldMap, newMap)
    // eslint-disable-next-line no-param-reassign
    oldMap = newMap
    return diff
  }

const diffCachedMap = makeDiffCachedMap(diffMapDeep)

module.exports = {
  makeDiffCachedMap,
  diffCachedMap
}
