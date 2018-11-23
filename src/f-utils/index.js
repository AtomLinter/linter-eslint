'use babel'

import {
  addIndex,
  compose,
  curry,
  filter,
  fromPairs,
  isNil,
  merge,
  map,
  not,
  path as keysTrail,
  reduce,
  toPairs
} from './mini-ramda'

/** **************
 * Typecasting *
 ************** */

// mapToObj :: Map -> Object
export const mapToObj = m => fromPairs([...m])

// objToMap :: Object -> Map
export const objToMap = o => new Map(toPairs(o))


/** ************
 * Predicates *
 ************* */

// False on undefined or null, else true
// isNotNil :: Any -> Boolean
export const notNil = compose(not, isNil)

// True on undefined, else false
// isUndef :: Any -> Boolean
export const isUndef = x => x === undefined


/** *****************
 * Extracting data *
 ****************** */

// Retreive value of nested property
//  * deepProp('a.b.c.d', obj) --> obj.a.b.c.d *
// deepProp :: String -> Object -> Any
export const deepProp = curry(
  (k, o) => keysTrail(k.split('.'), o)
)


/** *****************
 * Transformations *
 ****************** */

// unique :: [a] -> [a]
export const unique = xs => Array.from(new Set(xs))


/** *******************************
 * Modified callback signatures *
 ******************************** */

// Filter using additional key/index parameter
// iFilter :: KeyedFilterable f
//   => ((a, Int) -> Boolean) -> f a -> f a
export const keyedFilter = curry(
  (f, o) => (Array.isArray(o)
    ? addIndex(filter)(f, o)
    : reduce(
      (filtered, k) => merge(
        filtered,
        f(o[k], k, o)
          ? { [k]: o[k] }
          : null
      ),
      {},
      Object.keys(o)
    ))
)

// Map using additional key/index parameter
// iMap :: KeyedFunctor f
//   => ((a, Int) -> b) -> f a -> f b
export const keyedMap = curry(
  (f, o) => (Array.isArray(o)
    ? addIndex(map)(f, o)
    : reduce(
      (mapped, k) => merge(
        mapped,
        { [k]: f(o[k], k, o) }
      ),
      {},
      Object.keys(o)
    ))
)
