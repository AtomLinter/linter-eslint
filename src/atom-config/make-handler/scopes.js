'use babel'

import { replaceArrayInPlace } from '../../m-utils'

const setScopes = config => (array) => {
  const { lintHtmlFiles, embeddedScope, scopes } = config
  // Overwrite with new scopes
  replaceArrayInPlace(scopes, array)

  // Add source.js.embedded.html to scopes if needed
  if (lintHtmlFiles && !scopes.includes(embeddedScope)) {
    scopes.push(embeddedScope)
  }

  return config
}

export default setScopes
