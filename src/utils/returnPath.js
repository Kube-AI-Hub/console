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
  if (portal.studio) {
    entries.push('studio')
  }
  entries.push('models', 'plaza')
  if (portal.operations) {
    entries.push('operations')
  }
  return entries
}
