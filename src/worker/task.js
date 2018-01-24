'use babel'

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
import { Task } from 'atom'

const createWorkerTask = () => {
  let task = null
  let started = false
  const isConnected = () => !!(task && task.childProcess.connected)

  /**
   * Start the worker process if it hasn't already been started
   */
  const start = () => {
    if (task === null) {
      // Sometimes the worker dies and becomes disconnected
      // When that happens, it seems that there is no way to recover other
      // than to kill the worker and create a new one.
      if (isConnected === false) {
        task.kill()
      }
      task = new Task(require.resolve('./job.js'))
    }
    // Return if a start request already sent
    if (started) return false

    // Send empty arguments as we don't use them in the worker
    task.start([])
    started = true
    return true
  }

  /**
   * Force the worker Task to kill itself
   */
  const kill = () => {
    if (task !== null) {
      task.terminate()
      started = false
      task = null
    }
  }

  const on = (...args) => task.on(...args)
  const send = (...args) => task.send(...args)

  return {
    start,
    kill,
    on,
    send
  }
}

export default createWorkerTask
