
/** ***************
 * Merge objects *
 **************** */

// Shallowly-immutable Object.assign merge with less boilerplate
//
const merge = (...xs) => Object.assign({}, ...xs)

// Shallowly-immutable merge of 2 objects, with second merge param curried first
//
const mergeWith = y => x => merge(x, y)

module.exports = {
  merge,
  mergeWith
}
