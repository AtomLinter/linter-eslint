'use babel'

import { isValidPoint, hasValidScope } from '../../src/validate/editor'
import makeSpy from '../make-spy'

// NOTE throwIfInvalidPoint not covered,
// but it is a simple composition of 2 tested functions.

describe('isValidPoint', () => {
  it('returns true if clipped point reports being equal to point', () => {
    const mockPoint = { isEqual: () => true }
    const spy = makeSpy(mockPoint)
    const mockTextBuffer = { clipPosition: spy.call }
    const point = [34, 110]

    const result = isValidPoint(mockTextBuffer, ...point)
    expect(spy.calledWith[0][0]).toEqual(point)
    expect(result).toBe(true)
  })

  it('returns false if clipped point reports not being equal to point', () => {
    const mockPoint = { isEqual: () => false }
    const spy = makeSpy(mockPoint)
    const mockTextBuffer = { clipPosition: spy.call }
    const point = [12, 14]

    const result = isValidPoint(mockTextBuffer, ...point)
    expect(spy.calledWith[0][0]).toEqual(point)
    expect(result).toBe(false)
  })
})

describe('hasValidScope', () => {
  it('returns true if scopes array contains some value in validScopes', () => {
    const mockEditor = {
      getCursors: () => [{
        getScopeDescriptor: () => ({
          getScopesArray: () => ['valid.scope']
        })
      }]
    }
    const scopes = ['valid.scope']
    const result = hasValidScope(mockEditor, scopes)
    expect(result).toBe(true)
  })

  it('returns false when scopes array has no values in validScopes', () => {
    const mockEditor = {
      getCursors: () => [{
        getScopeDescriptor: () => ({
          getScopesArray: () => ['someother.scope']
        })
      }]
    }
    const scopes = ['invalid.scope']
    const result = hasValidScope(mockEditor, scopes)
    expect(result).toBe(false)
  })
})
