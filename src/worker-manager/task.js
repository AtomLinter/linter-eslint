'use babel'

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
import { Task } from 'atom'

// Some validators.
//
const isTask = task => task instanceof Task
const isConnected = task => task.childProcess.connected

// Spawn an Atom task child process and listen for events.
//
const createWorkerTask = (script = '../worker-process') => {
  let task = null
  let onSuccessListener
  let onFailListener

  // List of subscribers.
  //
  const subscriptions = {}

  // Generic handler for both succes and failure. Calls the
  // appropriate callback and disposes of subscriber. Each
  // job is single-fire, automatically disposing of both
  // success and error listeners at once.
  //
  const onEvent = (eventType, msg) => {
    const { jobId, response } = msg
    const subscriber = subscriptions[jobId]
    subscriber[eventType](response)
    delete subscriptions[jobId]
  }

  // External API function for adding subscriptions
  //
  const on = (eventType, jobId, fn) => {
    subscriptions[jobId] = subscriptions[jobId] || {}
    subscriptions[jobId][eventType] = fn
    return () => delete subscriptions[jobId]
  }

  // Force the worker Task to kill itself.
  //
  const kill = (preventResubscribe) => {
    // Dispose of subscriptions to the Task because they
    // are no longer valid.
    //
    if (onSuccessListener) {
      onSuccessListener.dispose()
    }
    if (onFailListener) {
      onFailListener.dispose()
    }

    // Send errors to any existing subscribers to let them know
    // their jobs cannot be fulfilled. Then throw out subscriptions.
    //
    Object.keys(subscriptions).forEach((key) => {
      // Set alternate "shut down" error message to prevent
      // existing jobs from trying to resubscribe.
      //
      const msg = preventResubscribe
        ? 'Worker shut down.'
        : 'Worker in charge of lint job died.'
      const error = new Error(msg)
      const { message, stack } = error

      subscriptions[key].fail({ message, stack })
      delete subscriptions[key]
    })

    // Kill the task
    //
    if (isTask(task)) {
      task.terminate()
      task = null
    }
  }

  // Start the worker process if it hasn't already been started
  //
  const start = () => {
    if (isTask(task)) {
      // Sometimes the worker dies and becomes disconnected
      // When that happens, it seems that there is no way to recover other
      // than to kill the worker and create a new one.
      //
      if (!isConnected(task)) kill()

      // If we already have a connected task, then nothing to do
      //
      else return false
    }

    // Create the task.
    //
    task = new Task(require.resolve(script))

    // Add event listeners. These are long-running, and will be removed
    // only after the worker is found to be dead.
    //
    onSuccessListener = task.on('success', (msg) => {
      onEvent('success', msg)
    })
    onFailListener = task.on('fail', (msg) => {
      onEvent('fail', msg)
    })

    // Start the task
    //
    task.start()
    return true
  }

  // Directly expose the tasks send method. Wrapped in anonymous fn
  // because Task must be started before accessing its methods.
  //
  const send = (...args) => task.send(...args)

  // Return the public API
  //
  return { start, kill, on, send }
}

export default createWorkerTask
