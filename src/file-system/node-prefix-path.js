'use babel'

import ChildProcess from 'child_process'
import getPath from 'consistent-path'
import { memo } from '../f-utils'

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
    throw new Error(preErrMsg)
  }
}

export default memo(getNodePrefixPath)
