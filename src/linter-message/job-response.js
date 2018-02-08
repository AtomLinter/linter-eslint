'use babel'

import knownRules from '../rules'
import eslintToLinter from './from-eslint'

/**
 * Processes the response from the lint job
 * @param  {Object}     response   The raw response from the job
 * @param  {TextEditor} textEditor The Atom::TextEditor of the file the messages belong to
 * @param  {bool}       showRule   Whether to show the rule in the messages
 * @return {Promise}               The messages transformed into Linter messages
 */

const processJobResponse = ({ response, textEditor, showRule }) => {
  const { rulesDiff, messages } = response
  knownRules().updateRules(rulesDiff)
  return eslintToLinter(messages, textEditor, showRule, knownRules)
}

export default processJobResponse
