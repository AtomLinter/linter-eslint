
/** ************************************************
 * Modify the call signature of existing function *
 ************************************************* */

const curry = require('ramda/src/curry')
const addIndex = require('ramda/src/addIndex')
const filter = require('ramda/src/filter')
const map = require('ramda/src/map')
const { merge } = require('./merge')

// Filter object properties with property keys passed
// as second argument to predicate function.
//
// keyedFilter :: (a, String|Number) -> Object<a> -> Object<a>
const keyedFilter = curry((f, o) => {
  if (Array.isArray(o)) {
    return addIndex(filter)(f, o)
  }
  return Object.keys(o)
    .reduce((filtered, k) => merge(
      filtered,
      f(o[k], k, o) ? { [k]: o[k] } : null
    ), {})
})
// Map over object properties with property keys passed
// as second argument to transforming function.
//
// keyedMap :: (a, String|Number) -> Object<a> -> Object<b>

const keyedMap = curry((f, o) => {
  if (Array.isArray(o)) {
    return addIndex(map)(f, o)
  }
  return Object.keys(o)
    .reduce((mapped, k) => merge(
      mapped,
      { [k]: f(o[k], k, o) }
    ), {})
})

module.exports = {
  keyedFilter,
  keyedMap
}
