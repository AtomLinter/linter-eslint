'use babel'

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
import { Task } from 'atom'

const createWorkerTask = () => {
  let task = null
  /**
   * Start the worker process if it hasn't already been started
   */
  const start = () => {
    if (task === null) {
      task = new Task(require.resolve('../worker.js'))
    }

    if (task.started) {
      // Worker start request has already been sent
      return
    }
    // Send empty arguments as we don't use them in the worker
    task.start([])

    // NOTE: Modifies the Task of the worker, but it's the only clean way to track this
    task.started = true
  }

  /**
   * Forces the worker Task to kill itself
   */

  const kill = () => {
    if (task !== null) {
      task.terminate()
      task = null
    }
  }

  const on = (...args) => task.on(...args)
  const send = (...args) => task.send(...args)

  const connected = () => task && task.childProcess.connected

  return {
    start,
    kill,
    on,
    send,
    connected
  }
}

export default createWorkerTask
