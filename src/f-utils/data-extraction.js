
/** **************************
 * Extract data from object *
 *************************** */

const curry = require('ramda/src/curry')
const path = require('ramda/src/path')

// Value of a nested property if it exists
//   * usage: deepProp('a.b.c.d', obj) == obj.a.b.c.d
//
// deepProp :: String -> Object -> Any
const deepProp = curry((k, o) => path(k.split('.'), o))

module.exports = {
  deepProp
}
