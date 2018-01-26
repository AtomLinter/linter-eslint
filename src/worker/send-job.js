'use babel'

import cryptoRandomString from 'crypto-random-string'

/**
 * Send a job to the worker and return the results
 * @param  {Object} config Configuration for the job to send to the worker
 * @return {Object|String|Error}        The data returned from the worker
 */
const makeSendJob = worker => async (config) => {
  // Ensure the worker is started
  worker.start()

  // Expand the config with a unique ID to emit on
  // NOTE: Jobs _must_ have a unique ID as they are completely async and results
  // can arrive back in any order.
  // eslint-disable-next-line no-param-reassign
  config.emitKey = cryptoRandomString(10)

  return new Promise((resolve, reject) => {
    // All worker errors are caught and re-emitted along with their associated
    // emitKey, so that we do not create multiple listeners for the same
    // 'task:error' event
    const errSub = worker.on(`workerError:${config.emitKey}`, ({ msg, stack }) => {
      // Re-throw errors from the task
      const error = new Error(msg)
      // Set the stack to the one given to us by the worker
      error.stack = stack
      errSub.dispose()
      // eslint-disable-next-line no-use-before-define
      responseSub.dispose()
      reject(error)
    })
    const responseSub = worker.on(config.emitKey, (data) => {
      errSub.dispose()
      responseSub.dispose()
      resolve(data)
    })
    // Send the job on to the worker
    try {
      worker.send(config)
    } catch (e) {
      errSub.dispose()
      responseSub.dispose()
      console.error(e)
    }
  })
}

export default makeSendJob
