'use babel'

import makeSpy from '../make-spy'
import { makeGetRootPaths } from '../../src/file-system/root-path'


describe('makeGetRootPaths', () => {
  it('transforms properties to an array including maybeDirname result')
  const disableEslintIgnore = false
  const projectPath = 'project path'
  const fileDir = 'file dir'

  const maybeDirSpy = makeSpy('dirname')

  const getRootPaths = makeGetRootPaths(maybeDirSpy.call)

  const rootPathProps = { disableEslintIgnore, projectPath, fileDir }

  expect(getRootPaths(rootPathProps)).toEqual([
    'dirname', 'project path', 'file dir'
  ])

  expect(maybeDirSpy.calledWith[0][0]).toEqual({
    disableEslintIgnore: false,
    fileDir: 'file dir'
  })
})
