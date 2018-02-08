'use babel'

// eslint-disable-next-line no-unused-vars
import diff from '../../src/f-utils/diff-map-deep'

describe('diffMapDeep', () => {
  it('finds added props', () => {
    const A = new Map([['prop1', { prop: 'addition default' }]])
    const B = new Map([
      ['prop1', { prop: 'addition default' }],
      ['prop2', { prop: 'addition plus' }]
    ])
    const { added } = diff(A, B)
    expect(added).toEqual({ prop2: { prop: 'addition plus' } })
  })

  it('finds removed props', () => {
    const A = new Map([
      ['prop1', { prop: 'removal minus' }],
      ['prop2', { prop: 'removal keeping' }]
    ])
    const B = new Map([
      ['prop2', { prop: 'removal keeping' }],
    ])

    const { removed } = diff(A, B)
    expect(removed).toEqual({ prop1: { prop: 'removal minus' } })
  })

  it('finds modified props', () => {
    const A = new Map([
      ['prop1', { prop: 'original key' }],
      ['prop2', { prop: 'original value' }],
      ['prop3', { prop: 'removing' }]
    ])
    const B = new Map([
      ['prop1', { differentKey: 'different key' }],
      ['prop2', { prop: 'different value' }]
    ])

    const { added, removed } = diff(A, B)
    expect(added).toEqual({
      prop1: { differentKey: 'different key' },
      prop2: { prop: 'different value' }
    })
    expect(removed).toEqual({
      prop1: { prop: 'original key' },
      prop2: { prop: 'original value' },
      prop3: { prop: 'removing' }
    })
  })
})
