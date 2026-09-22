const {
  resolvePortalTarget,
  portalEntryEnabled,
  isStudioGatewayPath,
} = require('./portalMounts')

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

  it('treats /studio* as the workshop gateway, including api and preview', () => {
    expect(isStudioGatewayPath('/studio')).toBe(true)
    expect(isStudioGatewayPath('/studio/overview')).toBe(true)
    expect(isStudioGatewayPath('/studio-api/auth/me')).toBe(true)
    expect(isStudioGatewayPath('/studio-preview/orchestration')).toBe(true)
    expect(isStudioGatewayPath('/platform-model')).toBe(false)
    expect(isStudioGatewayPath('/dongba')).toBe(false)
  })
})
