'use babel'

import { createRunner } from 'atom-jasmine3-test-runner'

module.exports = createRunner({
  testPackages: ['linter', 'linter-ui-default'],
  timeReporter: true,
  specHelper: true
})
