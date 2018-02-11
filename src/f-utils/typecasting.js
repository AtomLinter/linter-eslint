'use babel'

/** *********************************
 * Cast or transform between types *
 ********************************** */

import fromPairs from 'ramda/src/fromPairs'
import toPairs from 'ramda/src/toPairs'

// fromMapToObj :: Map a -> Object a
export const fromMapToObj = m => fromPairs([...m])

// fromObjToMap :: Object a -> Map a
export const fromObjToMap = o => new Map(toPairs(o))
