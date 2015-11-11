'use strict'
// Note: 'use babel' doesn't work in forked processes

const CP = require('childprocess-promise')

const Communication = new CP()

Communication.on('JOB', function(job) {
  job.Response = new Promise(function(resolve, reject) {
    resolve(2)
  })
})
