'use babel'

import throwIfFail from '../../src/validate/throw'

describe('throwIfFail', () => {
  it('throws an error when given falsey value', () => {
    const message = 'bad smurf'
    let caught = false

    try {
      throwIfFail(message, false)
    } catch (e) {
      caught = true
      expect(e.message).toBe('bad smurf')
    }
    expect(caught).toBe(true)
  })

  it('does not throw when given truthy value', () => {
    const message = 'this message is ignored'
    expect(throwIfFail(message, true)).toBe(true)
  })
})
