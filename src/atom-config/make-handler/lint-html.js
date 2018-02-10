
const { spliceDeleteFirst } = require('../../m-utils')


const hasHtmlScope = config =>
  config.scopes.indexOf(config.embeddedScope) !== -1

const setLintHtml = config => (value) => {
  const { scopes, embeddedScope } = config

  // eslint-disable-next-line no-param-reassign
  config.lintHtmlFiles = value

  // Add source.js.embedded.html to scopes if missing
  if (value && !hasHtmlScope(config)) {
    scopes.push(embeddedScope)
  } else if (hasHtmlScope(config)) {
    spliceDeleteFirst(embeddedScope, scopes)
  }

  return config
}

module.exports = setLintHtml
