'use babel'

/** ***********************************************
 * Memoizers for creating self-caching functions *
 ************************************************ */

// Simple, basic memoizer. Returns cached value if exists. Else calls
// given function with given arguments, caching and returning result.
//
// eslint-disable-next-line import/prefer-default-export
export const memo = (f) => {
  let cache
  return (...args) => {
    if (cache !== undefined) return cache

    cache = f(...args)
    return cache
  }
}
