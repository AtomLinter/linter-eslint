'use babel'

import {
  mapToObj,
  objToMap,
  notNil,
  isUndef,
  deepProp,
  unique,
  keyedFilter,
  keyedMap
} from '../../src/f-utils'

describe('mapToObj', () => {
  it('transforms a Map to an Object dictionary', () => {
    const source = new Map([
      ['a', 'some string'],
      ['b', 10],
      ['c', {}],
      ['d', null],
      ['e', undefined],
      ['f', []]
    ])

    const expected = {
      a: 'some string',
      b: 10,
      c: {},
      d: null,
      e: undefined,
      f: []
    }

    expect(mapToObj(source)).toEqual(expected)
  })
})

describe('objToMap', () => {
  it('transforms an Object dictionary to a Map', () => {
    const source = {
      a: 'some string',
      b: 25,
      c: {},
      d: null,
      e: undefined,
      f: []
    }

    const expected = new Map([
      ['a', 'some string'],
      ['b', 25],
      ['c', {}],
      ['d', null],
      ['e', undefined],
      ['f', []]
    ])

    expect(objToMap(source)).toEqual(expected)
  })
})

describe('notNil', () => {
  it('returns false for nil values', () => {
    expect(notNil(undefined)).toBe(false)
    expect(notNil(null)).toBe(false)
  })

  it('returns true for non-nil values', () => {
    expect(notNil(true)).toBe(true)
    expect(notNil(19)).toBe(true)
    expect(notNil(0)).toBe(true)
    expect(notNil({})).toBe(true)
    expect(notNil(new Map())).toBe(true)
    expect(notNil('')).toBe(true)
  })
})

describe('isUndef', () => {
  it('returns true for undefined values', () => {
    const undef = undefined
    expect(isUndef(undef)).toBe(true)
    expect(isUndef()).toBe(true)
  })

  it('returns false for defined values', () => {
    expect(isUndef(88)).toBe(false)
    expect(isUndef(0)).toBe(false)
    expect(isUndef('')).toBe(false)
    expect(isUndef([])).toBe(false)
    expect(isUndef({})).toBe(false)
    expect(isUndef(null)).toBe(false)
  })
})

describe('deepProp', () => {
  it('finds a shallow prop', () => {
    const obj = { a: '10' }
    expect(deepProp('a', obj)).toBe('10')
  })

  it('finds a deep prop', () => {
    const obj = { a: { b: { c: { d: { e: { g: 42 } } } } } }
    expect(deepProp('a.b.c.d.e.g', obj)).toBe(42)
  })

  it('does not choke on falsy values', () => {
    const obj = { a: { b: null } }
    expect(deepProp('a.b', obj)).toBe(null)
  })

  it('does not choke on undefined trail', () => {
    const obj = { a: { b: 'value' } }
    expect(deepProp('some.unknown.prop.path', obj))
      .toBe(undefined)
  })
})

describe('unique', () => {
  it('returns a new equivalent Array', () => {
    const array = [1, 2, 3]
    const uniqueArray = unique(array)

    expect(uniqueArray).toEqual(array)
    expect(uniqueArray).toNotBe(array)
  })

  it('removes duplicates', () => {
    const array = [1, undefined, 2, 3, 3, 2, undefined]

    const expected = [1, undefined, 2, 3]
    expect(unique(array)).toEqual(expected)
  })
})

describe('keyedFilter', () => {
  it("adds index and original array to predicate's params", () => {
    const array = [1, 2, 3]
    let i = 0
    const predicate = (value, index, arr) => {
      expect(index).toBe(i)
      expect(arr).toEqual(array)
      i += 1
      return value > 2
    }
    const expected = [3]

    const result = keyedFilter(predicate, array)
    expect(result).toEqual(expected)
  })
  it("adds key and original object to predicate's params", () => {
    const keys = ['a', 'b', 'c']
    const object = { a: 1, b: 2, c: 3 }
    let i = 0
    const predicate = (value, key, obj) => {
      expect(keys.indexOf(key)).toBe(i)
      expect(obj).toEqual(object)
      i += 1
      return key > 'b'
    }
    const expected = { c: 3 }

    const result = keyedFilter(predicate, object)
    expect(result).toEqual(expected)
  })
})

describe('keyedMap', () => {
  it("adds index and original array to transformer's params", () => {
    const array = [1, 2, 3]
    let i = 0
    const transformer = (value, index, arr) => {
      expect(index).toBe(i)
      expect(arr).toEqual(array)
      i += 1
      return value + 5
    }
    const expected = [6, 7, 8]

    const result = keyedMap(transformer, array)
    expect(result).toEqual(expected)
  })
  it("adds key and original object to transformer's params", () => {
    const keys = ['a', 'b', 'c']
    const object = { a: 1, b: 2, c: 3 }
    let i = 0
    const transformer = (value, key, obj) => {
      expect(keys.indexOf(key)).toBe(i)
      expect(obj).toEqual(object)
      i += 1
      return key
    }
    const expected = { a: 'a', b: 'b', c: 'c' }

    const result = keyedMap(transformer, object)
    expect(result).toEqual(expected)
  })
})
