'use babel'

import { generateRange } from 'atom-linter'

/**
 * Turn the given options into a Linter message array
 * @param  {TextEditor} textEditor The TextEditor to use to build the message
 * @param  {Object} options    The parameters used to fill in the message
 * @param  {string} [options.severity='error'] Can be one of: 'error', 'warning', 'info'
 * @param  {string} [options.excerpt=''] Short text to use in the message
 * @param  {string|Function} [options.description] Used to provide additional information
 * @return {Array}            Message to user generated from the parameters
 */
const simpleReport = (textEditor, {
  severity = 'error',
  excerpt = '',
  description,
} = {}) => [{
  severity,
  excerpt,
  description,
  location: {
    file: textEditor.getPath(),
    position: generateRange(textEditor),
  },
}]

export default simpleReport
