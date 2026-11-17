const normalizeBaseUrl = url =>
  String(url || '')
    .trim()
    .replace(/\/+$/, '')

function resolvePortalTarget(section) {
  if (!section || section.enabled !== true) {
    return ''
  }
  const target = normalizeBaseUrl(section.target)
  if (!/^https?:\/\//i.test(target)) {
    return ''
  }
  return target
}

/**
 * Whether a section is mounted at all.
 *
 * `selfHosted` means this process serves the section itself (the new console's
 * build is copied into this image and served here), so no upstream target exists
 * and none is required. Without it, a section needs a resolvable `target`.
 */
function portalEntryEnabled(section) {
  if (!section || section.enabled !== true) {
    return false
  }
  return section.selfHosted === true || Boolean(resolvePortalTarget(section))
}

function isStudioGatewayPath(pathname) {
  return typeof pathname === 'string' && pathname.startsWith('/studio')
}

/** Prefix the new console (kube-frontend) is mounted on, in this console's host. */
const NEW_CONSOLE_PREFIX = '/kube-frontend'

/**
 * Whether a path belongs to the mounted new console.
 *
 * The bare prefix counts: the app redirects `/kube-frontend` to `/kube-frontend/`
 * itself, so both have to reach it rather than fall through to the old console's
 * catch-all page renderer.
 */
function isNewConsolePath(pathname) {
  if (typeof pathname !== 'string') {
    return false
  }
  return (
    pathname === NEW_CONSOLE_PREFIX ||
    pathname.startsWith(`${NEW_CONSOLE_PREFIX}/`)
  )
}

/**
 * Remove the new console's prefix from a path.
 *
 * The new console's process does not know it is mounted on a prefix of this host,
 * so `/kube-frontend/api/v1/.../exec` has to arrive as `/api/v1/.../exec`. A path
 * outside the prefix is returned unchanged.
 */
function stripNewConsolePrefix(pathname) {
  if (!isNewConsolePath(pathname)) {
    return pathname
  }
  return pathname.slice(NEW_CONSOLE_PREFIX.length) || '/'
}

/**
 * Paths under the new console's prefix that belong to ks-apiserver, not to its build.
 *
 * The console's API requests are proxied straight to the API server (both HTTP and
 * WebSocket). Everything else under the prefix is its own static build. Keeping the
 * list here — rather than inline in `routes.js` and again in `wsProxy.js` — is what
 * stops the HTTP and WebSocket sides from disagreeing about where exec goes.
 */
const NEW_CONSOLE_API_PREFIXES = [
  `${NEW_CONSOLE_PREFIX}/kapis`,
  `${NEW_CONSOLE_PREFIX}/apis`,
  `${NEW_CONSOLE_PREFIX}/api/v1`,
  /*
   * The OIDC endpoints the console calls directly: `userinfo` (who am I) and
   * `logout` (revoke this token). Both are `/oauth/*` on the API server, so they
   * need the same forwarding as the resource prefixes — without this the console
   * receives the SPA shell instead of a session, and the page shows a signed-in
   * user it cannot identify.
   */
  `${NEW_CONSOLE_PREFIX}/oauth`,
]

function isNewConsoleApiPath(pathname) {
  if (typeof pathname !== 'string') {
    return false
  }
  return NEW_CONSOLE_API_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

module.exports = {
  NEW_CONSOLE_PREFIX,
  NEW_CONSOLE_API_PREFIXES,
  isNewConsoleApiPath,
  resolvePortalTarget,
  portalEntryEnabled,
  isStudioGatewayPath,
  isNewConsolePath,
  stripNewConsolePrefix,
}
