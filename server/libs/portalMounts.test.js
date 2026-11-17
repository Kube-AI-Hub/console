const {
  resolvePortalTarget,
  portalEntryEnabled,
  isStudioGatewayPath,
  isNewConsoleApiPath,
  stripNewConsolePrefix,
} = require('./portalMounts')

describe('portal mounts', () => {
  it('stays closed unless enabled with an http(s) target', () => {
    expect(resolvePortalTarget(undefined)).toBe('')
    expect(
      resolvePortalTarget({ enabled: false, target: 'http://studio' })
    ).toBe('')
    expect(resolvePortalTarget({ enabled: true, target: '' })).toBe('')
    expect(
      resolvePortalTarget({ enabled: true, target: 'studio.internal' })
    ).toBe('')
    expect(
      resolvePortalTarget({ enabled: true, target: 'http://studio.internal/' })
    ).toBe('http://studio.internal')
    expect(
      portalEntryEnabled({ enabled: true, target: 'https://ops.internal' })
    ).toBe(true)
    expect(portalEntryEnabled({ enabled: true, target: '' })).toBe(false)
  })

  /*
   * The new console's build is served by this process, so it has no upstream
   * target. Requiring one would hide the header entry on exactly the deployment
   * that ships the console.
   */
  it('treats a self-hosted section as mounted without a target', () => {
    expect(portalEntryEnabled({ enabled: true, selfHosted: true })).toBe(true)
    expect(
      portalEntryEnabled({ enabled: true, selfHosted: true, target: '' })
    ).toBe(true)
    // Disabled still wins: `selfHosted` is not an override for the switch.
    expect(portalEntryEnabled({ enabled: false, selfHosted: true })).toBe(false)
    // A section with neither is not mounted.
    expect(portalEntryEnabled({ enabled: true })).toBe(false)
  })

  it('treats /studio* as the workshop gateway, including api and preview', () => {
    expect(isStudioGatewayPath('/studio')).toBe(true)
    expect(isStudioGatewayPath('/studio/overview')).toBe(true)
    expect(isStudioGatewayPath('/studio-api/auth/me')).toBe(true)
    expect(isStudioGatewayPath('/studio-preview/orchestration')).toBe(true)
    expect(isStudioGatewayPath('/platform-model')).toBe(false)
    expect(isStudioGatewayPath('/dongba')).toBe(false)
  })

  /*
   * The new console's API paths go to ks-apiserver; its build is served here. The
   * split has to be the same for HTTP and for WebSocket upgrades, or an exec socket
   * ends up at the static handler and the terminal never connects.
   */
  it('routes the new console API prefixes to the API server, not to its build', () => {
    for (const path of [
      '/kube-frontend/kapis/version',
      '/kube-frontend/kapis/resources.kubesphere.io/v1alpha3/nodes',
      '/kube-frontend/apis/apps/v1/deployments',
      '/kube-frontend/api/v1/namespaces/demo/pods/web/exec',
    ]) {
      expect(isNewConsoleApiPath(path)).toBe(true)
    }
    // The build itself, its assets and its client routes are not API paths.
    for (const path of [
      '/kube-frontend',
      '/kube-frontend/',
      '/kube-frontend/assets/index-abc.js',
      '/kube-frontend/login',
      '/kube-frontend/clusters/host/overview',
      '/kube-frontend/apiserver',
      '/kapis/version',
    ]) {
      expect(isNewConsoleApiPath(path)).toBe(false)
    }
  })

  it('strips the mount prefix for both API and build paths', () => {
    expect(stripNewConsolePrefix('/kube-frontend/api/v1/nodes')).toBe(
      '/api/v1/nodes'
    )
    expect(stripNewConsolePrefix('/kube-frontend/kapis/version')).toBe(
      '/kapis/version'
    )
    expect(stripNewConsolePrefix('/kube-frontend')).toBe('/')
    // A path outside the prefix is left alone: this is also used for proxying
    // requests that arrive without it.
    expect(stripNewConsolePrefix('/kapis/version')).toBe('/kapis/version')
  })
})
