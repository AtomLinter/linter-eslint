'use babel'

/* eslint-disable import/no-extraneous-dependencies */
import { join } from 'path'
import { listTreeSync } from 'fs-plus'
import { runCLI } from 'jest-cli'

const specDir = join(__dirname, 'spec')

const specFiles = listTreeSync(specDir)
  .filter(path => path.match(/-spec.js$/))

export default ({
  buildAtomEnvironment,
  buildDefaultApplicationDelegate,
  logFile,
  testPaths,
  headless
}) => {
  global.buildAtomEnvironment = (params = {}) => {
    const defaultParams = {
      applicationDelegate: buildDefaultApplicationDelegate(),
      window,
      document,
      enablePersistence: false,
      configDirPath: process.env.ATOM_HOME
    }
    return buildAtomEnvironment(Object.assign({}, defaultParams, params))
  }
  global.atom = global.buildAtomEnvironment()

  const argv = {
    cache: false,
    _: testPaths,
    outputFile: logFile,
  }

  return runCLI(argv, [...specFiles])
    .then((resp) => {
      const exitCode = resp.results.success ? 0 : 1
      return headless ? (console.log(resp), exitCode) : exitCode
    })
    .catch((e) => {
      console.error(e.message)
      console.error(e.stack)
      return 1
    })
}
