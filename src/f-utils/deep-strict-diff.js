'use babel'

import deepEq from 'fast-deep-equal'
import { concat, compose as o } from './mini-ramda'
import { unique } from '.'

/** *****************************************
 * deepStrictDiff                          *
 *                                         *
 * Strictly compare contents of 2 objects, *
 * returning changes from a to b.          *
 ****************************************** */

// type Changes = { Object added, Object removed }
// type Key = String

// deepDiff :: a -> a -> Changes
const deepStrictDiff = (a, b) => {
  // uniqueKeys :: [Key]
  const uniqueKeys = o(unique, concat)(
    Object.keys(a),
    Object.keys(b)
  )

  // diffReducer :: ((Changes, Key) -> Changes)
  const diffReducer = ({ added, removed }, k) => {
    /* eslint-disable no-param-reassign */
    if (a[k] === undefined) {
      added[k] = b[k]
    } else if (b[k] === undefined) {
      removed[k] = a[k]
    } else if (deepEq(a[k], b[k]) === false) {
      added[k] = b[k]
      removed[k] = a[k]
    }
    return { added, removed }
  }
  /* eslint-enable */

  return uniqueKeys.reduce(
    diffReducer,
    { added: {}, removed: {} }
  )
}
export default deepStrictDiff
