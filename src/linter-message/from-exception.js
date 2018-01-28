'use babel'

import simpleReport from './simple'

/**
 * Generates a message to the user in order to nicely display the Error being
 * thrown instead of depending on generic error handling.
 * @param  {TextEditor} textEditor The TextEditor to use to build the message
 * @param  {Error} error      Error to generate a message for
 * @return {Array}            Message to user generated from the Error
 */
const fromExceptionToLinterMessage = (textEditor, error) => {
  const { stack, message } = error
  // Only show the first line of the message as the excerpt
  const excerpt = `Error while running ESLint: ${message.split('\n')[0]}.`
  const description = `<div style="white-space: pre-wrap">${message}\n<hr />${stack}</div>`
  return simpleReport(textEditor, { severity: 'error', excerpt, description })
}

export default fromExceptionToLinterMessage
