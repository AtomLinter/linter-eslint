'use babel'

const throwIfFail = (msg, passed) => {
  if (!passed) {
    throw new Error(msg)
  }
  return true
}

export default throwIfFail
