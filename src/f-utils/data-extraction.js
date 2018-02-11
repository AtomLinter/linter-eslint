'use babel'

/** **************************
 * Extract data from object *
 *************************** */

import curry from 'ramda/src/curry'
import path from 'ramda/src/path'

// Value of a nested property if it exists
//   * usage: deepProp('a.b.c.d', obj) == obj.a.b.c.d
//
// deepProp :: String -> Object -> Any
// eslint-disable-next-line import/prefer-default-export
export const deepProp = curry((k, o) => path(k.split('.'), o))
