'use babel'

import migrateConfigOptions from '../src/migrate-config-options'
import makeSpy from './make-spy'

describe('migrateConfigOptions()', () => {
  it('calls the migrate functions of objects in a proided migrations array', () => {
    const migrateSpy = makeSpy()
    const migrations = [{ migrate: migrateSpy.call }]
    migrateConfigOptions(migrations)
    expect(migrateSpy.called()).toEqual(true)
  })

  it('provides the linter-eslint config to migrate functions', () => {
    atom.config.set('linter-eslint.oldSetting', true)
    const migrateSpy = makeSpy()
    const migrations = [{ migrate: migrateSpy.call }]
    migrateConfigOptions(migrations)
    expect(migrateSpy.calledWith[0][0]).toEqual(atom.config.get('linter-eslint'))
  })

  it('moves configs using `moves` array in a provided migrations array', () => {
    atom.config.set('linter-eslint.oldSetting', true)
    const migrations = [{
      moves: [{
        old: 'oldSetting',
        new: 'newSetting',
      }],
    }]
    migrateConfigOptions(migrations)
    const oldSetting = atom.config.get('linter-eslint.oldSetting')
    const newSetting = atom.config.get('linter-eslint.newSetting')
    console.log({ oldSetting, newSetting })
    expect(oldSetting).toEqual(undefined)
    expect(newSetting).toEqual(true)
  })
})
