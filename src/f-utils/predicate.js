'use babel'

/** ****************************************************
 * Generic predicates for filtering or verifying data *
 ***************************************************** */

import pipe from 'ramda/src/pipe'
import isNil from 'ramda/src/isNil'
import not from 'ramda/src/not'

// False if parameter is null or undefined, else true
//
// isNotNil :: Any -> Boolean
export const isNotNil = pipe(isNil, not)

// True if parameter is undefined, else false
//
// isUndef :: Any -> Boolean
export const isUndef = x => x === undefined
