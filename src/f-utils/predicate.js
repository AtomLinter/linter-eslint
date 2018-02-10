
/** ****************************************************
 * Generic predicates for filtering or verifying data *
 ***************************************************** */

const pipe = require('ramda/src/pipe')
const isNil = require('ramda/src/isNil')
const not = require('ramda/src/not')

// False if parameter is null or undefined, else true
//
// isNotNil :: Any -> Boolean
const isNotNil = pipe(isNil, not)

// True if parameter is undefined, else false
//
// isUndef :: Any -> Boolean
const isUndef = x => x === undefined

module.exports = {
  isNotNil,
  isUndef
}
