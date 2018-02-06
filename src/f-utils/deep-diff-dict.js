'use babel'

/** ********************
 * deepDiffDictionary *
 ********************* */

import deepEq from 'fast-deep-equal'

// Diff 2 object dictionaries with deep comparison
//
// deepDiffDictionary :: Object a -> Object b -> Object c
const deepDiffDictionary = (a, b) => {
  const uniqueKeys = Array.from(new Set([
    ...Object.keys(a),
    ...Object.keys(b)
  ]))

  /* eslint-disable no-param-reassign */
  return uniqueKeys.reduce(({ added, removed }, k) => {
    if (a[k] === undefined) added[k] = b[k]
    else if (b[k] === undefined) removed[k] = a[k]
    else if (deepEq(a[k], b[k]) === false) {
      added[k] = b[k]
      removed[k] = a[k]
    }
    return { added, removed }
  }, { added: {}, removed: {} })
}

export default deepDiffDictionary
