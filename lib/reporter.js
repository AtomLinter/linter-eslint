'use strict'
// This file is used by eslint to hand the errors over to the worker
module.exports = function(results, config) {
  global.__LINTER_RESPONSE = {results, config}
}
