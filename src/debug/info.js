'use babel'

import { join } from 'path'
import { sendJob } from '../worker'

const debugInfo = async () => {
  const textEditor = atom.workspace.getActiveTextEditor()
  let filePath
  let editorScopes
  if (atom.workspace.isTextEditor(textEditor)) {
    filePath = textEditor.getPath()
    editorScopes = textEditor.getLastCursor().getScopeDescriptor().getScopesArray()
  } else {
    // Somehow this can be called with no active TextEditor, impossible I know...
    filePath = 'unknown'
    editorScopes = ['unknown']
  }
  const packagePath = atom.packages.resolvePackagePath('linter-eslint')
  let linterEslintMeta
  if (packagePath === undefined) {
    // Apparently for some users the package path fails to resolve
    linterEslintMeta = { version: 'unknown!' }
  } else {
    // eslint-disable-next-line import/no-dynamic-require
    linterEslintMeta = require(join(packagePath, 'package.json'))
  }
  const config = atom.config.get('linter-eslint')
  const hoursSinceRestart = Math.round((process.uptime() / 3600) * 10) / 10
  let returnVal
  try {
    const response = await sendJob({
      type: 'debug',
      config,
      filePath
    })
    returnVal = {
      atomVersion: atom.getVersion(),
      linterEslintVersion: linterEslintMeta.version,
      linterEslintConfig: config,
      // eslint-disable-next-line import/no-dynamic-require
      eslintVersion: require(join(response.path, 'package.json')).version,
      hoursSinceRestart,
      platform: process.platform,
      eslintType: response.type,
      eslintPath: response.path,
      editorScopes,
    }
  } catch (error) {
    atom.notifications.addError(`${error}`)
  }
  return returnVal
}

export default debugInfo
