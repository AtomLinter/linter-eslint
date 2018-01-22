'use babel'

// eslint-disable-next-line no-unused-vars
import 'jasmine-fix'
import freeze from 'deep-freeze'
import { join } from 'path'
import { readFile as fsReadFile } from 'fs'
import r from '../../../src/f-utils/mini-ramda'

import reducer from '../../../src/store/reducers/rules'
import { rules as actions } from '../../../src/store/actions'

const { UPDATE, REPLACE } = actions

/**
 * A little bit of setup for later. We will use the full list
 * of rules generated from linting this project, which is stored
 * in a json file on disk. Start loading the file right away.
 */

// promisify fs.readFile
const readFile = path => new Promise((resolve, reject) =>
  fsReadFile(path, (e, data) => (e ? reject(e) : resolve(data))))

// Promise to import file and parse it into Object dictionary.
const bigRulesList = readFile(join(__dirname, '../../fixtures/rules.json'))
  .then(
    r.pipe(JSON.parse, r.prop('rules'), r.fromPairs),
    e => expect(`Error loading bigRulesList -- ${e.message}`)
      .toBe(false)
  )

/**
 *
 */

describe('rules reducer', () => {
  it('returns empty object if given no state or action', () => {
    const result = reducer()
    expect(result).toEqual({})
  })


  it('returns provided state when action does not match', () => {
    const state = freeze({ prop: 'key' })
    const action = { type: Symbol('not a rules action') }

    const noActionState = reducer(state)
    expect(noActionState).toEqual(state)

    const unmatchedActionState = reducer(state, action)
    expect(unmatchedActionState).toBe(state)
  })

  describe('UPDATE action', () => {
    it('adds rules', () => {
      const initialState = freeze({})
      const actionA = {
        type: UPDATE,
        changes: { added: { aRule: { prop: 'value' } } }
      }

      const stateA = freeze(reducer(initialState, actionA))
      expect(stateA).toEqual({ aRule: { prop: 'value' } })

      const actionB = {
        type: UPDATE,
        changes: {
          added: {
            bRule: { prop: 'value' },
            cRule: { prop: 'value' },
            dRule: { prop: 'value' }
          }
        }
      }

      const stateB = reducer(stateA, actionB)
      expect(stateB).toEqual({
        aRule: { prop: 'value' },
        bRule: { prop: 'value' },
        cRule: { prop: 'value' },
        dRule: { prop: 'value' }
      })
    })


    it('removes rules', () => {
      const initialState = freeze({
        aRule: { prop: 'value' },
        bRule: { prop: 'value' },
        cRule: { prop: 'value' }
      })
      const actionA = {
        type: UPDATE,
        changes: { removed: { aRule: { prop: 'value' } } }
      }

      const stateA = freeze(reducer(initialState, actionA))
      expect(stateA).toEqual({
        bRule: { prop: 'value' },
        cRule: { prop: 'value' }
      })

      const actionB = {
        type: UPDATE,
        changes: {
          removed: {
            bRule: { prop: 'value' },
            cRule: { prop: 'value' }
          }
        }
      }

      const stateB = reducer(stateA, actionB)
      expect(stateB).toEqual({})
    })


    it('edits rules', () => {
      const initialState = freeze({
        aRule: { prop: 'initial value' },
        bRule: { prop: 'initial value' },
        cRule: { prop: 'initial value' }
      })
      const actionA = {
        type: UPDATE,
        changes: {
          added: { aRule: { prop: 'new value' } },
          removed: {
            aRule: { prop: 'initial value' },
            cRule: { prop: 'initial value' }
          }
        }
      }

      const state = reducer(initialState, actionA)
      expect(state).toEqual({
        aRule: { prop: 'new value' },
        bRule: { prop: 'initial value' }
      })
    })

    it('quietly discards invalid rules', () => {
      const initialState = freeze({ aRule: {} })
      const action = {
        type: UPDATE,
        changes: {
          added: {
            bRule: null,
            cRule: {}
          }
        }
      }

      const newState = reducer(initialState, action)
      expect(newState).toEqual({ aRule: {}, cRule: {} })
    })


    it('easily handles lots of rules holding deep nested objects', async () => {
      const rules = await bigRulesList

      const initialState = freeze({})
      const action = {
        adding: { type: UPDATE, changes: { added: rules } },
        removal: { type: UPDATE, changes: { removed: rules } }
      }

      const start = performance.now()
      const addedState = freeze(reducer(initialState, action.adding))
      const removedState = reducer(initialState, action.removal)
      const end = performance.now()

      expect(addedState).toEqual(rules)
      expect(removedState).toEqual({})

      // 100 ms seems quite arbitrary. What is a reasonable
      // worst-case time for this operation in testing?
      expect(end - start < 100)
        .toBe(true, 'Rules UPDATE performance test took too long.')
    })
  })

  describe('REPLACE action', () => {
    it('replaces an empty state with rules list', () => {
      const initialState = freeze({})
      const rules = { prop: {} }
      const action = {
        type: REPLACE,
        rules
      }

      const newState = reducer(initialState, action)
      expect(newState).toEqual({ prop: {} })
    })


    it('replaces an existing state with new rules', () => {
      const initialState = freeze({ oldProp: {} })
      const rules = { newProp: {} }
      const action = {
        type: REPLACE,
        rules
      }

      const newState = reducer(initialState, action)
      expect(newState).toEqual({ newProp: {} })
    })


    it('quietly discards invalid rules', () => {
      const initialState = freeze({
        aRule: {},
        bRule: {}
      })
      const rules = { bRule: {}, cRule: {} }
      const action = {
        type: REPLACE,
        rules
      }

      const newState = reducer(initialState, action)
      expect(newState).toEqual({ bRule: {}, cRule: {} })
    })


    it('easily handles lots of rules holding deep nested objects', async () => {
      const rules = await bigRulesList

      const initialState = freeze({})
      const action = { type: REPLACE, rules }

      const start = performance.now()
      const newState = reducer(initialState, action)
      const end = performance.now()

      expect(newState).toEqual(rules)

      // 50 ms seems quite arbitrary. What is a reasonable
      // worst-case time for this operation in testing?
      expect(end - start < 50)
        .toBe(true, 'Rules REPLACE performance test took too long.')
    })
  })
})
