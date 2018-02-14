'use babel'

import { toIgnored } from '../rules'
import {
  replaceArrayInPlace,
  spliceDeleteFirst
} from '../m-utils'


export const setValue = (config, rule) => value =>
  Object.assign(config, { [rule]: value })


export const setIgnoredFixes = config => array =>
  Object.assign(config, { ignoredRulesWhenFixing: toIgnored(array) })


export const hasHtmlScope = config =>
  config.scopes.indexOf(config.embeddedScope) !== -1


export const setLintHtml = config => (value) => {
  const { scopes, embeddedScope } = config

  // Add source.js.embedded.html to scopes if missing
  if (value && !hasHtmlScope(config)) {
    scopes.push(embeddedScope)
  } else if (hasHtmlScope(config)) {
    spliceDeleteFirst(embeddedScope, scopes)
  }

  return Object.assign(config, { lintHtmlFiles: value })
}


export const setScopes = config => (array) => {
  const { lintHtmlFiles, embeddedScope, scopes } = config

  // Overwrite with new scopes
  replaceArrayInPlace(scopes, array)

  // Add source.js.embedded.html to scopes if needed
  if (lintHtmlFiles && !scopes.includes(embeddedScope)) {
    scopes.push(embeddedScope)
  }
  return config
}
