
// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
const { Range } = require('atom')
const { generateRange } = require('atom-linter')
const { throwIfInvalidPoint } = require('../validate/editor')
const invalidTrace = require('./invalid-trace')

/**
 * Given a raw response from ESLint, this processes the messages into a format
 * compatible with the Linter API.
 * @param  {Object}     messages   The messages from ESLint's response
 * @param  {TextEditor} textEditor The Atom::TextEditor of the file the messages belong to
 * @param  {bool}       showRule   Whether to show the rule in the messages
 * @param  {Rules}      rules      List of known rules with helper methods
 * @return {Promise}               The messages transformed into Linter messages
 */
const fromEslintToLinterMessage = (messages, textEditor, showRule, rules) =>
  // `invalidTrace` in catch block at bottom returns a promise.
  Promise.all(messages.map(({
    fatal, message: originalMessage, line, severity, ruleId, column, fix, endLine, endColumn
  }) => {
    const message = fatal ? originalMessage.split('\n')[0] : originalMessage
    const filePath = textEditor.getPath()
    const textBuffer = textEditor.getBuffer()
    let linterFix = null
    if (fix) {
      const fixRange = new Range(
        textBuffer.positionForCharacterIndex(fix.range[0]),
        textBuffer.positionForCharacterIndex(fix.range[1])
      )
      linterFix = {
        position: fixRange,
        replaceWith: fix.text
      }
    }
    let msgCol
    let msgEndLine
    let msgEndCol
    let eslintFullRange = false

    /*
      Note: ESLint positions are 1-indexed, while Atom expects 0-indexed,
      positions. We are subtracting 1 from these values here so we don't have to
      keep doing so in later uses.
      */
    const msgLine = line - 1
    if (typeof endColumn !== 'undefined' && typeof endLine !== 'undefined') {
      eslintFullRange = true
      // Here we always want the column to be a number
      msgCol = Math.max(0, column - 1)
      msgEndLine = endLine - 1
      msgEndCol = endColumn - 1
    } else {
      // We want msgCol to remain undefined if it was initially so
      // `generateRange` will give us a range over the entire line
      msgCol = typeof column !== 'undefined' ? column - 1 : column
    }

    let ret = {
      severity: severity === 1 ? 'warning' : 'error',
      location: {
        file: filePath,
      }
    }

    if (ruleId) {
      ret.url = rules().getRuleUrl(ruleId)
    }

    let range
    try {
      if (eslintFullRange) {
        const buffer = textEditor.getBuffer()
        throwIfInvalidPoint(buffer, msgLine, msgCol)
        throwIfInvalidPoint(buffer, msgEndLine, msgEndCol)
        range = [[msgLine, msgCol], [msgEndLine, msgEndCol]]
      } else {
        range = generateRange(textEditor, msgLine, msgCol)
      }
      ret.location.position = range

      const ruleAppendix = showRule ? ` (${ruleId || 'Fatal'})` : ''
      ret.excerpt = `${message}${ruleAppendix}`

      if (linterFix) {
        ret.solutions = [linterFix]
      }
    } catch (err) {
      ret = invalidTrace({
        msgLine,
        msgCol,
        msgEndLine,
        msgEndCol,
        eslintFullRange,
        filePath,
        textEditor,
        ruleId,
        message,
      })
    }

    return ret
  }))

module.exports = fromEslintToLinterMessage
