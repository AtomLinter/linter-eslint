'use babel'

/** ************************************************
 * Modify the call signature of existing function *
 ************************************************* */

import curry from 'ramda/src/curry'
import addIndex from 'ramda/src/addIndex'
import filter from 'ramda/src/filter'
import map from 'ramda/src/map'

// Filter object properties with property keys passed
// as second argument to predicate function.
//
// keyedFilter :: (a, String|Number) -> Object<a> -> Object<a>
export const keyedFilter = curry((f, o) => {
  if (Array.isArray(o)) {
    return addIndex(filter)(f, o)
  }
  return Object.keys(o)
    .reduce((filtered, k) => ({
      ...filtered,
      ...(f(o[k], k, o) ? { [k]: o[k] } : null)
    }), {})
})

// Map over object properties with property keys passed
// as second argument to transforming function.
//
// keyedMap :: (a, String|Number) -> Object<a> -> Object<b>

export const keyedMap = curry((f, o) => {
  if (Array.isArray(o)) {
    return addIndex(map)(f, o)
  }
  return Object.keys(o)
    .reduce((mapped, k) => ({
      ...mapped,
      [k]: f(o[k], k, o)
    }), {})
})
