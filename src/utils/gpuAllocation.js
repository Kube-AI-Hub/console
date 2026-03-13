/*
 * Parse Pod annotations for GPU device allocations (HAMi devices-allocated format).
 * Format: container segments separated by ";", device segments by ":", fields "uuid,type,mem,core".
 * Compatible with hami.io/vgpu-devices-allocated and other *devices-allocated keys.
 */

const CONTAINER_SEP = ';'
const DEVICE_SEP = ':'
const FIELD_SEP = ','
const MIN_FIELDS = 4

/**
 * Extract physical GPU UUID for linking (strip MIG suffix like [1-1]).
 * @param {string} uuid - Raw UUID e.g. "GPU-xxx" or "GPU-xxx[1-1]"
 * @returns {string}
 */
export function getPhysicalUuid(uuid) {
  if (!uuid || typeof uuid !== 'string') return ''
  const idx = uuid.indexOf('[')
  return idx > 0 ? uuid.slice(0, idx).trim() : uuid.trim()
}

/**
 * Parse a single device segment "uuid,type,mem,core".
 * @param {string} segment
 * @returns {{ uuid: string, vendor: string, memoryMi: number, corePercent: number } | null}
 */
function parseDeviceSegment(segment) {
  const s = segment.trim()
  if (!s) return null
  const parts = s.split(FIELD_SEP).map(p => p.trim())
  if (parts.length < MIN_FIELDS) return null
  const uuid = parts[0]
  const vendor = parts[1] || ''
  const memoryMi = parseInt(parts[2], 10) || 0
  const corePercent = parseInt(parts[3], 10) || 0
  return { uuid, vendor, memoryMi, corePercent }
}

/**
 * Parse one annotation value (all containers/devices for one key).
 * @param {string} value
 * @returns {Array<{ uuid: string, vendor: string, memoryMi: number, corePercent: number }>}
 */
function parseAnnotationValue(value) {
  if (!value || typeof value !== 'string') return []
  const out = []
  const containerSegs = value.split(CONTAINER_SEP)
  for (const cSeg of containerSegs) {
    const deviceSegs = cSeg.split(DEVICE_SEP)
    for (const dSeg of deviceSegs) {
      const dev = parseDeviceSegment(dSeg)
      if (dev) out.push(dev)
    }
  }
  return out
}

/**
 * Parse pod annotations into a list of GPU allocation entries.
 * Scans all keys containing "devices-allocated". For MIG, physicalUuid is used for status link.
 *
 * @param {Record<string, string>} annotations - Pod metadata.annotations
 * @returns {Array<{ annotationKey: string, uuid: string, physicalUuid: string, vendor: string, memoryMi: number, corePercent: number }>}
 */
export function parseGpuAllocationsFromAnnotations(annotations) {
  if (!annotations || typeof annotations !== 'object') return []
  const seen = new Set()
  const result = []
  for (const [key, value] of Object.entries(annotations)) {
    if (!key || !key.includes('devices-allocated')) continue
    const devices = parseAnnotationValue(value)
    for (const dev of devices) {
      const physicalUuid = getPhysicalUuid(dev.uuid)
      const dedupeKey = `${key}\t${physicalUuid || dev.uuid}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      result.push({
        annotationKey: key,
        uuid: dev.uuid,
        physicalUuid: physicalUuid || dev.uuid,
        vendor: dev.vendor,
        memoryMi: dev.memoryMi,
        corePercent: dev.corePercent,
      })
    }
  }
  return result
}
