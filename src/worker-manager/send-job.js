'use babel'

import cryptoRandomString from 'crypto-random-string'

/**
 * Curried wrapper to allow preloading a worker.
 * @param {Object} worker A Worker Manager controlling an Atom task
 * @return {Function} sendJob function
 */
const makeSendJob = worker =>
  /**
   * Send a job to the worker and return promise for the results
   * @param  {Object} config Configuration for the job to send to the worker
   * @return {Promise<Object|Error>}        The data returned from the worker
   */
  (config) => {
    // Expand the config with a unique ID to emit on
    // NOTE: Jobs _must_ have a unique ID as they are completely async and results
    // can arrive back in any order.
    const jobId = cryptoRandomString(10)
    // eslint-disable-next-line no-param-reassign
    config.jobId = jobId

    const sendJob = () => new Promise((resolve, reject) => {
      // All Exceptions in the worker are caught and emitted as error event
      const onFail = ({ message, stack }) => {
        // Rebuild Error object emitted by the task
        const error = new Error(message)
        error.stack = stack

        // If worker just died, then log the failure and resend job.
        if (message === 'Worker in charge of lint job died.') {
          console.error(error)
          resolve(sendJob())

        // Otherwise rethrow
        } else reject(error)
      }

      // Ensure the worker is started
      worker.start()

      // Subscribe to worker events
      // NOTE This is *not* subscribing directly to an Atom Task.
      // The worker manager takes care of disposals internally.
      //
      worker.on('fail', jobId, onFail)
      worker.on('success', jobId, resolve)

      // Send the job on to the worker
      worker.send(config)
    })

    return sendJob()
  }


export default makeSendJob
