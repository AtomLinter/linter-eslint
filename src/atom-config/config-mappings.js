
const { setLintHtml, setScopes, setIgnoredFixes } = require('./make-handler')

// appVarName is variable name for setting used throughout the app
//
// pkgJsonName is var name used in package.json
//   defaults to appVarName
//
// makeHandler is semi-curried subscription handler
//   defaults to simple value setter setValue
//
module.exports = [
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
    appVarName: 'showRule',
    pkgJsonName: 'showRuleIdInMessage'
  },
  {
    appVarName: 'ignoredRulesWhenModified',
    pkgJsonName: 'rulesToSilenceWhileTyping'
  },
  {
    appVarName: 'lintHtmlFiles',
    makeHandler: setLintHtml
  },
  {
    appVarName: 'scopes',
    makeHandler: setScopes
  },
  {
    appVarName: 'ignoredRulesWhenFixing',
    pkgJsonName: 'rulesToDisableWhileFixing',
    makeHandler: setIgnoredFixes
  }
]
