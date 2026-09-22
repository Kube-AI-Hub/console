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

module.exports = {
  resolvePortalTarget,
  portalEntryEnabled,
}
