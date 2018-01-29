'use babel'

/**
 *  Small tools to make intentional mutations easier to read and understand.
 */

// Replace one array with another while keeping the original pointer
//
export const replaceArrayInPlace = (oldArray, newArray) => {
  oldArray.splice(0, oldArray.length)
  Array.prototype.push.apply(oldArray, newArray)
  return oldArray
}

// Replace 1 item in an array
//
export const spliceReplace1 = (elem, array) => {
  array.splice(array.indexOf(elem), 1)
  return array
}
