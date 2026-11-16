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

  it('shows the new console entry only when it is mounted', () => {
    // A link to a deployment that is not mounted is a 404, so the entry rides on
    // the same flag the proxy uses.
    expect(visibleProductEntries({ newConsole: true })).toEqual([
      'workbench',
      'newConsole',
      'models',
      'plaza',
    ])
    expect(visibleProductEntries({ newConsole: false })).toEqual([
      'workbench',
      'models',
      'plaza',
    ])
  })
})
