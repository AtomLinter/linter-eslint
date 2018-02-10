
const ChildProcess = require('child_process')
const getPath = require('consistent-path')
const { memo } = require('../f-utils')

// Get node prefix as reported by npm
//
const getNodePrefixPath = () => {
  const preErrMsg = 'Unable to execute `npm get prefix`. Please make sure ' +
  'Atom is getting $PATH correctly.'

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const env = Object.assign({}, process.env, { PATH: getPath() })

  try {
    return ChildProcess
      .spawnSync(npmCommand, ['get', 'prefix'], { env })
      .output[1]
      .toString().trim()
  } catch (e) {
    const preErr = new Error(preErrMsg)
    preErr.stack = e.stack
    throw preErr
  }
}

module.exports = memo(getNodePrefixPath)
