'use babel'

/*  eslint-disable import/no-extraneous-dependencies */

import { createRunner } from 'atom-mocha-test-runner'
import { listTreeSync } from 'fs-plus'
import { join } from 'path'

console.log('mocha runner')
const options = {
  htmlTitle: 'Linter ESLint Test Suite',
  colors: true
}

// For some reason the runner is failing to find the spec files.
// So we'll build the list our selves and give it directly to mocha.
const configFn = (mocha) => {
  const weAreMutatingMocha = mocha
  weAreMutatingMocha.files = listTreeSync(join(__dirname, 'spec'))
    .filter(path => path.match(/-spec.js$/))
}

export default createRunner(options, configFn)
