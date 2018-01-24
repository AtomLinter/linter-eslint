'use babel'

import r from '../f-utils/mini-ramda'

/** *************
 * Typecasting *
 ************** */

// fromMapToObj :: Map a -> Object a
export const fromMapToObj = m => r.fromPairs([...m])

// fromObjToMap :: Object a -> Map a
export const fromObjToMap = o => new Map(r.toPairs(o))


/** ************
 * Predicates *
 ************* */

// False if parameter is null or undefined, else true
//
// isNotNil :: Any -> Boolean
export const isNotNil = r.pipe(r.isNil, r.not)

// True if parameter is undefined, else false
//
// isUndef :: Any -> Boolean
export const isUndef = x => x === undefined


/** *****************
 * Extracting data *
 ****************** */

// Value of a nested property if it exists
//   * usage: deepProp('a.b.c.d', obj) == obj.a.b.c.d
//
// deepProp :: String -> Object -> Any
export const deepProp = r.curry((k, o) => r.path(k.split('.'), o))


/** *******************************
 * Modifying callback signatures *
 ******************************** */

// Filter object properties with property keys passed
// as second argument to predicate function.
//
// keyedFilter :: (a, String|Number) -> Object<a> -> Object<a>
export const keyedFilter = r.curry((f, o) => {
  if (Array.isArray(o)) {
    return r.addIndex(r.filter)(f, o)
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

export const keyedMap = r.curry((f, o) => {
  if (Array.isArray(o)) {
    return r.addIndex(r.map)(f, o)
  }
  return Object.keys(o)
    .reduce((mapped, k) => ({
      ...mapped,
      [k]: f(o[k], k, o)
    }), {})
})
