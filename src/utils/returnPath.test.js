import { safeReturnPath, visibleProductEntries } from './returnPath'

describe('safeReturnPath', () => {
  it('keeps same-origin paths and drops open redirects', () => {
    expect(safeReturnPath('/dongba/console/runtime')).toBe('/dongba/console/runtime')
    expect(safeReturnPath('/platform-model/models')).toBe('/platform-model/models')
    expect(safeReturnPath('https://evil.example')).toBe('')
    expect(safeReturnPath('//evil.example')).toBe('')
    expect(safeReturnPath('/\\evil')).toBe('')
    expect(safeReturnPath('')).toBe('')
  })
})

describe('visibleProductEntries', () => {
  it('hides workshop and governance until their mounts are enabled', () => {
    expect(visibleProductEntries({})).toEqual(['workbench', 'models', 'plaza'])
    expect(visibleProductEntries({ studio: true, operations: true })).toEqual([
      'workbench',
      'studio',
      'models',
      'plaza',
      'operations',
    ])
  })
})
