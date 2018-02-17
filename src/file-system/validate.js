'use babel'

import { statSync } from 'fs'

// eslint-disable-next-line import/prefer-default-export
export const isDirectory = (dirPath) => {
  try {
    return statSync(dirPath).isDirectory()
  } catch (e) {
    return false
  }
}
