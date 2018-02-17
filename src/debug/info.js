'use babel'

import { join } from 'path'
import { sendJob } from '../worker-manager'
import { isDirectory } from '../file-system'

const resolvePackage = atom.packages.resolvePackagePath.bind(atom.packages)
// Somehow this can be called with no active TextEditor, impossible I know...
const isTextEditor = atom.workspace.isTextEditor.bind(atom.workspace)

const toHours = seconds => Math.round((seconds / 3600) * 10) / 10

const maybeScopes = editor => (isTextEditor(editor)
  ? editor.getLastCursor().getScopeDescriptor().getScopesArray()
  : ['unknown'])

const maybeFilePath = editor => (isTextEditor(editor)
  ? editor.getPath() : 'unknown')

const maybeVersion = (pkgRoot, defaultVal = 'unknown') => {
  try {
    // eslint-disable-next-line import/no-dynamic-require
    return require(join(pkgRoot, 'package.json')).version
  } catch (e) {
    return defaultVal
  }
}

const debugInfo = async () => {
  const textEditor = atom.workspace.getActiveTextEditor()
  const config = atom.config.get('linter-eslint')
  const { eslintDir, eslintType } = await sendJob({
    jobType: 'debug',
    config,
    filePath: maybeFilePath(textEditor)
  })

  return {
    atomVersion: atom.getVersion(),
    editorScopes: maybeScopes(textEditor),
    eslintDir,
    eslintDirIsDir: isDirectory(eslintDir),
    eslintType,
    eslintVersion: maybeVersion(eslintDir),
    hoursSinceRestart: toHours(process.uptime()),
    // Apparently for some users the package path fails to resolve
    linterEslintVersion: maybeVersion(resolvePackage('linter-eslint')),
    linterEslintConfig: config,
    platform: process.platform,
  }
}

export default debugInfo
