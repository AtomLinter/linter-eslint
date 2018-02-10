'use babel'

import { join } from 'path'
import makeSpy from '../make-spy'
import {
  makeMaybeDirname,
  cdToFirstTruthy
} from '../../src/file-system/fs-utils'

const fsFixturePath = () => join(__dirname, '..', 'fixtures', 'fs')

describe('maybeDirname', () => {
  it('returns null and does not call dirname if given a falsy argument', () => {
    const dirnameSpy = makeSpy()
    const maybeDirname = makeMaybeDirname(dirnameSpy.call)

    const result = maybeDirname(false)
    expect(result).toBe(null)
    expect(dirnameSpy.called()).toBe(0)
  })

  it('returns result of calling dirname with argument if truthy', () => {
    const dirnameSpy = makeSpy()
    const filename = 'filename'
    const maybeDirname = makeMaybeDirname(dirnameSpy.call)

    const result = maybeDirname(filename)
    expect(result).toBe('called spy')
    expect(dirnameSpy.calledWith[0][0]).toBe(filename)
  })
})

describe('cdToFirstTruthy', () => {
  it('calls chdir with first truthy value in an array', () => {
    const validPath = fsFixturePath()
    const anotherValidPath = join(fsFixturePath(), 'get-ignore')
    const first = [validPath, undefined, null]
    const last = [null, undefined, anotherValidPath]

    expect(process.cwd()).toNotBe(validPath)

    cdToFirstTruthy(first)
    expect(process.cwd()).toBe(validPath)

    cdToFirstTruthy(last)
    expect(process.cwd()).toBe(anotherValidPath)
  })
})
