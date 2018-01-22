'use babel'

import throwIfFail from './throw'

export const isValidPoint = (textBuffer, line, column) => {
  // Clip the given point to a valid one
  const validPoint = textBuffer.clipPosition([line, column])
  // Compare to original
  return validPoint.isEqual([line, column])
}

export const throwIfInvalidPoint = (textBuffer, line, column) =>
  throwIfFail(
    `${line}:${column} isn't a valid point!`,
    isValidPoint(textBuffer, line, column)
  )

export const hasValidScope = (editor, validScopes) => editor.getCursors()
  .some(cursor => cursor.getScopeDescriptor()
    .getScopesArray()
    .some(scope => validScopes.includes(scope)))
