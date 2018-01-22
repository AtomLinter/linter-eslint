'use babel'

import 'jasmine-fix'
import { createStore as createWorkerStore } from '../../src/store/worker'
import { createStore as createMainStore } from '../../src/store/main'
import { replaceRules, diffRules } from '../../src/store/actions/rules'

// Both stores share the same `rules` reducer. So we can use shared tests
// against `rules` to ensure basic functionality of the stores.

describe('worker store', () => {
  it('creates a store of the correct shape', () => {
    const stores = [
      createWorkerStore(),
      createMainStore()
    ]
    stores.forEach((store) => {
      const state = store.getState()
      const branchKeys = ['rules'] // list all expected branches here
      const foundKeys = branchKeys
        .filter(k => Object.keys(state).includes(k))

      expect(foundKeys.length).toBe(branchKeys.length)
    })
  })

  it('updates state through dispatched action', () => {
    const stores = [
      createWorkerStore(),
      createMainStore()
    ]
    stores.forEach((store) => {
      expect(store.getState().rules).toEqual({})

      const rules = { rule1: { meta: {} } }
      const action = replaceRules(rules)
      store.dispatch(action)

      expect(store.getState().rules).toEqual({
        rule1: { meta: {} }
      })
    })
  })

  it('updates state through dipatched thunk', () => {
    const stores = [
      createWorkerStore(),
      createMainStore()
    ]
    stores.forEach((store) => {
      const initialRules = { rule1: { meta: {} } }
      store.dispatch(replaceRules(initialRules))
      expect(store.getState().rules).toEqual(initialRules)

      const rules = {
        rule1: { meta: {} },
        rule2: { meta: {} }
      }
      const action = diffRules(rules)
      const returnedDiff = store.dispatch(action)

      expect(returnedDiff).toEqual({
        added: { rule2: { meta: {} } },
        removed: {}
      })
      expect(store.getState().rules).toEqual({ ...rules })
    })
  })
})
