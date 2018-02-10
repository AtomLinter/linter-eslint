
const throwIfFail = (msg, passed) => {
  if (!passed) {
    throw new Error(msg)
  }
  return true
}

module.exports = throwIfFail
