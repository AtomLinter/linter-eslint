
/** ***********************************************
 * Memoizers for creating self-caching functions *
 ************************************************ */

// Simple, basic memoizer. Returns cached value if exists. Else calls
// given function with given arguments, caching and returning result.
//
const memo = (f) => {
  let cache
  return (...args) => {
    if (cache !== undefined) return cache

    cache = f(...args)
    return cache
  }
}

// Simple memoizer that passes cache to called function as the first param.
//
const passInMemo = (f) => {
  let cache
  return (...args) => {
    cache = f(cache, ...args)
    return cache
  }
}

module.exports = {
  memo,
  passInMemo
}
