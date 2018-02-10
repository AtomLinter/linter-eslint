
const createWorkerTask = require('./task')
const makeSendJob = require('./send-job')

const workerTask = createWorkerTask()

module.exports = {
  task: workerTask,
  sendJob: makeSendJob(workerTask)
}
