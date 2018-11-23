'use babel'

import diff from '../../src/f-utils/deep-strict-diff'

describe('deepDiff', () => {
  it('finds added props', () => {
    const A = { prop1: { prop: 'value' } }
    const B = {
      prop1: { prop: 'value' },
      prop2: { prop: 'value' }
    }

    const { added } = diff(A, B)
    expect(added).toEqual({ prop2: { prop: 'value' } })
  })
  it('finds removed props', () => {
    const A = {
      prop1: { prop: 'value' },
      prop2: { prop: 'value' }
    }
    const B = { prop2: { prop: 'value' } }

    const { removed } = diff(A, B)
    expect(removed).toEqual({ prop1: { prop: 'value' } })
  })
  it('finds modified props', () => {
    const A = {
      prop1: { prop: 'value' },
      prop2: { prop: 'value' },
      prop3: { prop: 'value' }
    }
    const B = {
      prop1: { differentProp: 'value' },
      prop2: { prop: 'different value' }
    }

    const { added, removed } = diff(A, B)

    expect(added).toEqual({
      prop1: { differentProp: 'value' },
      prop2: { prop: 'different value' }
    })

    expect(removed).toEqual({
      prop1: { prop: 'value' },
      prop2: { prop: 'value' },
      prop3: { prop: 'value' }
    })
  })
})
