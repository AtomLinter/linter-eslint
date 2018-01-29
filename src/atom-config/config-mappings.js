'use babel'

import { setLintHtml, setScopes, setArray, setIgnoredFixes } from './make-handler'

// appVarName is variable name for setting used throughout the app
//
// pkgJsonName is var name used in package.json
//   defaults to appVarName
//
// makeHandler is semi-curried subscription handler
//   defaults to simple value setter setValue
//
export default [
  { appVarName: 'useGlobalEslint' },
  { appVarName: 'disableWhenNoEslintConfig' },
  { appVarName: 'eslintrcPath' },
  { appVarName: 'globalNodePath' },
  { appVarName: 'advancedLocalNodeModules' },
  { appVarName: 'eslintRulesDirs' },
  { appVarName: 'disableFSCache' },
  { appVarName: 'disableEslintIgnore' },
  { appVarName: 'fixOnSave' },
  { appVarName: 'ignoreFixableRulesWhileTyping' },
  {
    appVarName: 'lintHtmlFiles',
    pkgJsonName: 'lintHtmlFiles',
    makeHandler: setLintHtml
  },
  {
    appVarName: 'showRule',
    pkgJsonName: 'showRuleIdInMessage'
  },
  {
    appVarName: 'scopes',
    makeHandler: setScopes
  },
  {
    appVarName: 'ignoredRulesWhenModified',
    pkgJsonName: 'rulesToSilenceWhileTyping',
    makeHandler: setArray
  },
  {
    appVarName: 'ignoredRulesWhenFixing',
    pkgJsonName: 'rulesToDisableWhileFixing',
    makeHandler: setIgnoredFixes
  }
]
