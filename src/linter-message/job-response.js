
const { rules } = require('../rules')
const eslintToLinter = require('./from-eslint')

/**
 * Processes the response from the lint job
 * @param  {Object}     response   The raw response from the job
 * @param  {TextEditor} textEditor The Atom::TextEditor of the file the messages belong to
 * @param  {bool}       showRule   Whether to show the rule in the messages
 * @return {Promise}               The messages transformed into Linter messages
 */

const processJobResponse = ({
  text,
  response,
  textEditor,
  showRule
}) => {
  /*
  If the editor text was modified since the lint was triggered,
  we cannot be sure the results will map properly back to
  the new contents. Simply return `null` to tell the
  `provideLinter` Consumer not to update the saved results.
  */
  if (textEditor.getText() !== text) {
    return null
  }

  const { rulesDiff, messages } = response
  rules().updateRules(rulesDiff)
  return eslintToLinter(messages, textEditor, showRule, rules)
}

module.exports = processJobResponse
