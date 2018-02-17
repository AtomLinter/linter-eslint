'use babel'

import debugInfo from './info'

const debugReport = async () => {
  const debug = await debugInfo()
  const details = [
    `Atom version: ${debug.atomVersion}`,
    `linter-eslint version: ${debug.linterEslintVersion}`,
    `ESLint version: ${debug.eslintVersion}`,
    `Hours since last Atom restart: ${debug.hoursSinceRestart}`,
    `Platform: ${debug.platform}`,
    (debug.eslintDirIsDir
      ? `Using ${debug.eslintType} ESLint from: ${debug.eslintDir}`
      : `Could not find ${debug.eslintType} ESLint at ${debug.eslintDir}`),
    `Current file's scopes: ${JSON.stringify(debug.editorScopes, null, 2)}`,
    `linter-eslint configuration: ${JSON.stringify(debug.linterEslintConfig, null, 2)}`
  ]
  return details.join('\n')
}

export default debugReport
