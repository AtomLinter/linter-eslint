'use babel'

/** ********************
 * deepDiffMap *
 ********************* */

import deepEq from 'fast-deep-equal'

// Diff two Maps which have keys compatible with Object keys
// using a deep Object comparison on the values
//
// diffMapDeep ::Map a -> Map  b -> Object c
const diffMapDeep = (a, b) => {
  const uniqueKeys = Array.from(new Set([
    ...a.keys(),
    ...b.keys()
  ]))

  const diff = ({ added, removed }, k) => {
    const A = a.get(k)
    const B = b.get(k)

    /* eslint-disable no-param-reassign */
    if (A === undefined) added[k] = B
    else if (B === undefined) removed[k] = A
    else if (deepEq(A, B) === false) {
      added[k] = B
      removed[k] = A
    }
    /* eslint-enable no-param-reassign */

    return { added, removed }
  }

  return uniqueKeys.reduce(diff, { added: {}, removed: {} })
}

export default diffMapDeep
