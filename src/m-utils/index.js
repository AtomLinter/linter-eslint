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

// Delete first instance of 1 item in an array
//
export const spliceDeleteFirst = (elem, array) => {
  const i = array.indexOf(elem)
  if (i >= 0) { array.splice(i, 1) }
  return array
}
