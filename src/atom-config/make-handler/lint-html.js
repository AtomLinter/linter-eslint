'use babel'

import { spliceReplace1 } from '../../m-utils'


const hasHtmlScope = config =>
  config.scopes.indexOf(config.embeddedScope) !== -1

/* eslint-disable no-param-reassign */

const setLintHtml = config => (value) => {
  const { scopes, embeddedScope } = config
  // set lintHtmlFiles
  config.lintHtmlFiles = value
  // add html to scopes if missing
  if (value && !hasHtmlScope(config)) {
    scopes.push(embeddedScope)
  } else if (hasHtmlScope(config)) {
    spliceReplace1(embeddedScope, scopes)
  }
  return config
}

export default setLintHtml
