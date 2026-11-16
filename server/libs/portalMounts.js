const normalizeBaseUrl = url => String(url || '').trim().replace(/\/+$/, '')

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

function portalEntryEnabled(section) {
  return Boolean(resolvePortalTarget(section))
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

module.exports = {
  NEW_CONSOLE_PREFIX,
  resolvePortalTarget,
  portalEntryEnabled,
  isStudioGatewayPath,
  isNewConsolePath,
  stripNewConsolePrefix,
}
