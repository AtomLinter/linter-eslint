
const { statSync } = require('fs')

const isDirectory = (dirPath) => {
  try {
    return statSync(dirPath).isDirectory()
  } catch (e) {
    return false
  }
}

module.exports = {
  isDirectory
}
