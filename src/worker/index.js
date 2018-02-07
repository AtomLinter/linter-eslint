'use babel'

import Rules from '../rules'
import createWorkerTask from '../worker/task'
import makeSendJob from './send-job'
import { fromEslint as eslintToLinter } from '../linter-message'

// TODO: This is the wrong place for the Rules instances.
// It has nothing to do with managing the worker.
export const rules = new Rules()

const workerTask = createWorkerTask()
export { workerTask as task }

export const sendJob = makeSendJob(workerTask)

/**
 * Processes the response from the lint job
 * @param  {Object}     response   The raw response from the job
 * @param  {TextEditor} textEditor The Atom::TextEditor of the file the messages belong to
 * @param  {bool}       showRule   Whether to show the rule in the messages
 * @return {Promise}               The messages transformed into Linter messages
 */
export const processJobResponse = (response, textEditor, showRule) => {
  try {
    if (response.updatedRules) {
      rules.replaceRules(response.updatedRules)
    }
  } catch (e) { console.error(e) }
  return eslintToLinter(response.messages, textEditor, showRule, rules)
}
