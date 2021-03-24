'use babel'

import { createRunner } from 'atom-jasmine3-test-runner'
import pkg from '../package.json'

export default createRunner({
  testPackages: pkg['package-deps'].map(p => p.name),
  timeReporter: true,
  specHelper: true
})
