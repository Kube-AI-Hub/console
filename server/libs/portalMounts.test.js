const { resolvePortalTarget, portalEntryEnabled } = require('./portalMounts')

describe('portal mounts', () => {
  it('stays closed unless enabled with an http(s) target', () => {
    expect(resolvePortalTarget(undefined)).toBe('')
    expect(resolvePortalTarget({ enabled: false, target: 'http://studio' })).toBe('')
    expect(resolvePortalTarget({ enabled: true, target: '' })).toBe('')
    expect(resolvePortalTarget({ enabled: true, target: 'studio.internal' })).toBe('')
    expect(resolvePortalTarget({ enabled: true, target: 'http://studio.internal/' })).toBe(
      'http://studio.internal'
    )
    expect(portalEntryEnabled({ enabled: true, target: 'https://ops.internal' })).toBe(true)
    expect(portalEntryEnabled({ enabled: true, target: '' })).toBe(false)
  })
})
