'use strict'
// This file is used by eslint to hand the errors over to the worker
module.exports = function (results) {
  global.__LINTER_ESLINT_RESPONSE = results[0].messages
}
