export function safeReturnPath(value) {
  if (typeof value !== 'string') {
    return ''
  }
  const trimmed = value.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return ''
  }
  if (trimmed.includes('\\') || trimmed.includes('\n') || trimmed.includes('\r') || trimmed.includes('://')) {
    return ''
  }
  return trimmed
}

export function visibleProductEntries(portal = {}) {
  const entries = ['workbench']
  // The new console is a separate application mounted on this host's
  // `/kube-frontend`; the entry appears only when it is actually mounted, so a
  // deployment without it never shows a link to a 404.
  if (portal.newConsole) {
    entries.push('newConsole')
  }
  if (portal.studio) {
    entries.push('studio')
  }
  entries.push('models', 'plaza')
  if (portal.operations) {
    entries.push('operations')
  }
  return entries
}
