'use babel'

// eslint-disable-next-line no-unused-vars
import {
  fromMapToObj,
  fromObjToMap,
  isNotNil,
  deepProp,
  keyedFilter,
  keyedMap,
} from '../../src/f-utils'


describe('fromMapToObj', () => {
  it('transforms a Map to an Object dictionary', () => {
    const map = new Map([['a', 'some string'], ['b', 10], ['c', {}]])
    const expected = { a: 'some string', b: 10, c: {} }
    expect(fromMapToObj(map)).toEqual(expected)
  })

  it('returns empty object if given empty map', () => {
    const map = new Map()
    const expected = {}
    expect(fromMapToObj(map)).toEqual(expected)
  })
})


describe('fromObjToMap', () => {
  it('transforms an Object dictionary to a Map', () => {
    const obj = { a: 'some string', b: 25, c: {} }
    const expected = new Map([['a', 'some string'], ['b', 25], ['c', {}]])
    expect(fromObjToMap(obj)).toEqual(expected)
  })

  it('returns empty map if given empty object', () => {
    const obj = {}
    const expected = new Map()
    expect(fromObjToMap(obj)).toEqual(expected)
  })
})


describe('isNotNil', () => {
  it('returns false for nil values', () => {
    expect(isNotNil(undefined)).toBe(false)
    expect(isNotNil(null)).toBe(false)
  })

  it('returns true for non-nil values', () => {
    expect(isNotNil(true)).toBe(true)
    expect(isNotNil(19)).toBe(true)
    expect(isNotNil({})).toBe(true)
    expect(isNotNil(new Map())).toBe(true)
  })
})


describe('deepProp', () => {
  it('finds a shallow prop', () => {
    const obj = { a: '10', b: 0 }
    expect(deepProp('a', obj)).toBe('10')
  })

  it('finds a deep prop', () => {
    const obj = { a: { b: { c: { d: { e: { f: -1, g: 42 } } } } } }
    expect(deepProp('a.b.c.d.e.g', obj)).toBe(42)
  })

  it('does not choke on falsy values', () => {
    const obj = { a: { b: null } }
    expect(deepProp('a.b', obj)).toBe(null)
  })

  it('fails gracefully', () => {
    const obj = { a: { b: 'value' } }
    expect(deepProp('some.unknown.prop.path', obj)).toBe(undefined)
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
    const result = keyedFilter(predicate, array)
    expect(result).toEqual([3])
  })

  it("adds property key and original object to predicate's params", () => {
    const keys = ['a', 'b', 'c']
    const object = { a: 1, b: 2, c: 3 }
    let i = 0
    const predicate = (value, key, obj) => {
      expect(keys.indexOf(key)).toBe(i)
      expect(obj).toEqual(object)
      i += 1
      return key > 'b'
    }
    const result = keyedFilter(predicate, object)
    expect(result).toEqual({ c: 3 })
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
    const result = keyedMap(transformer, array)
    expect(result).toEqual([6, 7, 8])
  })

  it("adds property key and original object to transformer's params", () => {
    const keys = ['a', 'b', 'c']
    const object = { a: 1, b: 2, c: 3 }
    let i = 0
    const transformer = (value, key, obj) => {
      expect(keys.indexOf(key)).toBe(i)
      expect(obj).toEqual(object)
      i += 1
      return key
    }
    const result = keyedMap(transformer, object)
    expect(result).toEqual({ a: 'a', b: 'b', c: 'c' })
  })
})
