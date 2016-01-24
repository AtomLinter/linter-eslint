'use babel'

import * as Helpers from '../lib/worker-helpers'
import {getFixturesPath} from './common'

describe('Worker Helpers', function() {

  describe('getESLintInstance && getESLintFromDirectory', function() {
    it('tries to find a local eslint', function() {
      const eslint = Helpers.getESLintInstance(getFixturesPath('local-eslint'), {})
      expect(eslint).toBe('located')
    })
    it('cries if local eslint is not found', function() {
      expect(function() {
        Helpers.getESLintInstance(getFixturesPath('files', {}))
      }).toThrow()
    })

    it('tries to find a global eslint if config is specified', function() {
      const eslint = Helpers.getESLintInstance(getFixturesPath('local-eslint'), {
        useGlobalEslint: true,
        globalNodePath: getFixturesPath('global-eslint')
      })
      expect(eslint).toBe('located')
    })
    it('cries if global eslint is not found', function() {
      expect(function() {
        Helpers.getESLintInstance(getFixturesPath('local-eslint'), {
          useGlobalEslint: true
        })
      }).toThrow()
    })
  })

})
