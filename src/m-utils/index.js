
/**
 *  Small tools to make intentional mutations easier to read and understand.
 */

// Replace one array with another while keeping the original pointer
//
const replaceArrayInPlace = (oldArray, newArray) => {
  oldArray.splice(0, oldArray.length)
  Array.prototype.push.apply(oldArray, newArray)
  return oldArray
}

// Delete first instance of 1 item in an array
//
const spliceDeleteFirst = (elem, array) => {
  const i = array.indexOf(elem)
  if (i >= 0) { array.splice(i, 1) }
  return array
}

module.exports = {
  replaceArrayInPlace,
  spliceDeleteFirst
}
