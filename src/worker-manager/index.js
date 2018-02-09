'use babel'

import createWorkerTask from './task'
import makeSendJob from './send-job'

const workerTask = createWorkerTask()
export { workerTask as task }

export const sendJob = makeSendJob(workerTask)
