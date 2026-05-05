/*
 * This file is part of KubeSphere Console.
 * Copyright (C) 2019 The KubeSphere Console Authors.
 *
 * KubeSphere Console is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * KubeSphere Console is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with KubeSphere Console.  If not, see <https://www.gnu.org/licenses/>.
 */

import { get } from 'lodash'

import { memoryFormat } from './index'

const getGpuDisplayName = resourceName => {
  if (!resourceName) return ''
  const metadata = get(globals, 'config.supportGpuTypeMetadata', {})
  return (metadata[resourceName] && metadata[resourceName].displayName) || resourceName
}

const getSimplifiedGpuDisplayName = displayName => {
  if (!displayName || typeof displayName !== 'string') return displayName
  const idx = displayName.indexOf('-')
  if (idx <= 0) return displayName
  return displayName.slice(0, idx).trim()
}

/**
 * Expand Kubernetes resource.Quantity for GPU extended memory keys.
 * Those values use decimal SI suffixes only (k, M, G, T, P, E); Ki/Mi/Gi do not appear.
 * API may canonicalize 20000 as "20k" (×1000). Pod memory "512Mi" etc. does not end with a
 * single-letter decimal suffix and is returned unchanged (this helper is also used on memory).
 */
export const normalizeGpuMemoryQuantity = value => {
  if (value === undefined || value === null || value === '') return value
  if (typeof value !== 'string') return value
  const s = value.trim()
  if (s === '') return value

  const decimalSuffixes = [
    ['E', 1e18],
    ['P', 1e15],
    ['T', 1e12],
    ['G', 1e9],
    ['M', 1e6],
    ['k', 1e3],
    ['K', 1e3],
  ]
  for (const [suffix, mult] of decimalSuffixes) {
    if (s.endsWith(suffix)) {
      const numPart = s.slice(0, -suffix.length).trim()
      const n = Number(numPart)
      if (!Number.isFinite(n)) return value
      const intVal = Math.round(n * mult)
      return String(intVal)
    }
  }

  return value
}

const getGpuMemoryUnitByMemoryKey = memoryKey => {
  const supportGpuType = get(globals, 'config.supportGpuType', [])
  const supportGpuTypeMetadata = get(globals, 'config.supportGpuTypeMetadata', {})
  const gpuType = supportGpuType.find(resourceName => {
    const meta = supportGpuTypeMetadata[resourceName] || {}
    return meta.memoryName === memoryKey
  })
  if (!gpuType) return 'Mi'
  const meta = supportGpuTypeMetadata[gpuType] || {}
  return meta.memoryUnit || 'Mi'
}

// memoryFormat treats bare numbers as bytes; GPU extended memory is plain / decimal-SI only, then suffixed per metadata.
const coerceGpuMemoryValueForMemoryFormat = (rawValue, memoryUnit = 'Mi') => {
  const v = normalizeGpuMemoryQuantity(rawValue)
  if (v === undefined || v === null || v === '') return v
  const s = String(v).trim()
  const unit = String(memoryUnit || 'Mi')
  if (/^[0-9.]+$/.test(s) && (unit === 'Mi' || unit === 'Gi')) {
    return `${s}${unit}`
  }
  return s
}

export const formatResourceItems = (resources = {}, type, opts = {}) => {
  const { showGpuSubResources = true, simplifyGpuName = false } = opts
  const resourceType = resources[type]
  if (!resourceType) return []

  const supportGpuType = get(globals, 'config.supportGpuType', [])
  const supportGpuTypeMetadata = get(globals, 'config.supportGpuTypeMetadata', {})
  const gpuCardUnit = t('GPU_CARD_UNIT')
  const gpuCardUnitText = gpuCardUnit === 'GPU_CARD_UNIT' ? '' : gpuCardUnit
  const gpuMemoryText = t('GPU_MEMORY_TOTAL')
  const gpuMemoryLabel =
    gpuMemoryText === 'GPU_MEMORY_TOTAL' ? 'GPU Memory' : gpuMemoryText
  const gpuCoreText = t('CORE_TOTAL_SCAP')
  const gpuCoreLabel = gpuCoreText === 'CORE_TOTAL_SCAP' ? 'Core' : gpuCoreText
  const getFinalGpuDisplayName = resourceName => {
    const gpuDisplayName = getGpuDisplayName(resourceName)
    return simplifyGpuName
      ? getSimplifiedGpuDisplayName(gpuDisplayName)
      : gpuDisplayName
  }

  return Object.keys(resourceType)
    .map(key => {
      const rawValue = resourceType[key]
      const isCpu = key === 'cpu'
      const value =
        isCpu && typeof rawValue === 'string' && rawValue.endsWith('m')
          ? parseInt(rawValue, 10) / 1000
          : rawValue

      if (supportGpuType.includes(key)) {
        const finalGpuDisplayName = getFinalGpuDisplayName(key)
        const gpuValue = gpuCardUnitText
          ? `${value} ${gpuCardUnitText}`
          : String(value)
        return `${finalGpuDisplayName}: ${gpuValue}`
      }

      const gpuTypeByMemory = supportGpuType.find(resourceName => {
        const meta = supportGpuTypeMetadata[resourceName] || {}
        return meta.memoryName === key
      })
      if (gpuTypeByMemory) {
        if (!showGpuSubResources) return null
        const meta = supportGpuTypeMetadata[gpuTypeByMemory] || {}
        const memoryUnit = meta.memoryUnit || 'Mi'
        const normalizedMemoryValue = normalizeGpuMemoryQuantity(value)
        const coercedForFormat = coerceGpuMemoryValueForMemoryFormat(
          normalizedMemoryValue,
          memoryUnit
        )
        const memoryValue =
          memoryUnit === 'Mi' || memoryUnit === 'Gi'
            ? `${memoryFormat(coercedForFormat, 'Gi')} Gi`
            : `${memoryFormat(coercedForFormat, 'Mi')} ${memoryUnit}`
        return `${getFinalGpuDisplayName(gpuTypeByMemory)} ${gpuMemoryLabel}: ${memoryValue}`
      }

      const gpuTypeByVcores = supportGpuType.find(resourceName => {
        const meta = supportGpuTypeMetadata[resourceName] || {}
        return meta.vcoresName === key
      })
      if (gpuTypeByVcores) {
        if (!showGpuSubResources) return null
        return `${getFinalGpuDisplayName(gpuTypeByVcores)} ${gpuCoreLabel}: ${value}%`
      }

      const translationKey = `${key.toUpperCase().replace(/[^A-Z]/g, '_')}_VALUE`
      const translated = t(translationKey, { value })
      if (translated === translationKey) {
        return `${key}: ${value}`
      }
      return translated
    })
    .filter(Boolean)
}

export const formatResourceInfo = (resources = {}, type, opts = {}) => {
  const { separator = ' / ' } = opts
  const items = formatResourceItems(resources, type, opts)
  return items.length > 0 ? items.join(separator) : '-'
}

export const formatContainersResourceInfo = (containers = [], type, opts = {}) => {
  const {
    includeContainerName = false,
    containerSeparator = ' | ',
    emptyValue = '-',
  } = opts
  if (!Array.isArray(containers) || containers.length === 0) return emptyValue

  const lines = containers
    .map(container => {
      const text = formatResourceInfo(container.resources || {}, type, opts)
      if (text === emptyValue) return null
      if (!includeContainerName) return text
      return `${container.name || t('CONTAINER')}: ${text}`
    })
    .filter(Boolean)

  return lines.length > 0 ? lines.join(containerSeparator) : emptyValue
}

export const formatContainersResourceLines = (containers = [], type, opts = {}) => {
  const { includeContainerName = false } = opts
  if (!Array.isArray(containers) || containers.length === 0) return []

  const lines = []
  containers.forEach(container => {
    const items = formatResourceItems(container.resources || {}, type, opts)
    if (items.length === 0) return
    if (includeContainerName) {
      const containerName = container.name || t('CONTAINER')
      items.forEach(item => {
        lines.push(`${containerName}: ${item}`)
      })
      return
    }
    lines.push(...items)
  })

  return lines
}

const parseNumber = value => {
  if (value === undefined || value === null || value === '') return NaN
  const n = Number(String(value).replace(/%/g, '').trim())
  return Number.isFinite(n) ? n : NaN
}

const parseCpuMilli = value => {
  if (value === undefined || value === null || value === '') return NaN
  const s = String(value).trim()
  if (s.endsWith('m')) {
    const n = Number(s.slice(0, -1))
    return Number.isFinite(n) ? n : NaN
  }
  const n = Number(s)
  return Number.isFinite(n) ? n * 1000 : NaN
}

const sumResourceValue = (key, current, next, gpuMemoryKeys) => {
  if (current === undefined) return next
  if (next === undefined) return current

  if (key === 'cpu') {
    const a = parseCpuMilli(current)
    const b = parseCpuMilli(next)
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return `${a + b}m`
    }
    return current
  }

  if (key === 'memory') {
    const a = memoryFormat(normalizeGpuMemoryQuantity(current), 'Mi')
    const b = memoryFormat(normalizeGpuMemoryQuantity(next), 'Mi')
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return `${a + b}Mi`
    }
    return current
  }

  if (gpuMemoryKeys.has(key)) {
    const memUnit = getGpuMemoryUnitByMemoryKey(key)
    const a = memoryFormat(
      coerceGpuMemoryValueForMemoryFormat(normalizeGpuMemoryQuantity(current), memUnit),
      'Mi'
    )
    const b = memoryFormat(
      coerceGpuMemoryValueForMemoryFormat(normalizeGpuMemoryQuantity(next), memUnit),
      'Mi'
    )
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return `${a + b}Mi`
    }
    return current
  }

  const a = parseNumber(current)
  const b = parseNumber(next)
  if (Number.isFinite(a) && Number.isFinite(b)) {
    return `${a + b}`
  }
  return current
}

const scaleResourceValue = (key, value, factor, gpuMemoryKeys) => {
  if (factor === 1) return value
  if (value === undefined || value === null || value === '') return value
  const f = Number(factor)
  if (!Number.isFinite(f)) return value

  if (key === 'cpu') {
    const milli = parseCpuMilli(value)
    if (Number.isFinite(milli)) return `${milli * f}m`
    return value
  }

  if (key === 'memory') {
    const mi = memoryFormat(normalizeGpuMemoryQuantity(value), 'Mi')
    if (Number.isFinite(mi)) return `${mi * f}Mi`
    return value
  }

  if (gpuMemoryKeys.has(key)) {
    const memUnit = getGpuMemoryUnitByMemoryKey(key)
    const mi = memoryFormat(
      coerceGpuMemoryValueForMemoryFormat(normalizeGpuMemoryQuantity(value), memUnit),
      'Mi'
    )
    if (Number.isFinite(mi)) return `${mi * f}Mi`
    return value
  }

  const n = parseNumber(value)
  if (Number.isFinite(n)) return `${n * f}`
  return value
}

export const aggregateContainersResources = (containers = [], type, opts = {}) => {
  const { multiplier = 1 } = opts
  if (!Array.isArray(containers) || containers.length === 0) return {}
  const supportGpuType = get(globals, 'config.supportGpuType', [])
  const supportGpuTypeMetadata = get(globals, 'config.supportGpuTypeMetadata', {})
  const gpuMemoryKeys = new Set()
  supportGpuType.forEach(resourceName => {
    const meta = supportGpuTypeMetadata[resourceName] || {}
    if (meta.memoryName) {
      gpuMemoryKeys.add(meta.memoryName)
    }
  })

  const aggregated = {}
  containers.forEach(container => {
    const resourceType = get(container, ['resources', type], {})
    Object.keys(resourceType || {}).forEach(key => {
      aggregated[key] = sumResourceValue(
        key,
        aggregated[key],
        resourceType[key],
        gpuMemoryKeys
      )
    })
  })

  Object.keys(aggregated).forEach(key => {
    aggregated[key] = scaleResourceValue(
      key,
      aggregated[key],
      multiplier,
      gpuMemoryKeys
    )
  })

  return { [type]: aggregated }
}

export const formatAggregatedContainersResourceLines = (
  containers = [],
  type,
  opts = {}
) => {
  const aggregatedResources = aggregateContainersResources(containers, type, opts)
  return formatResourceItems(aggregatedResources, type, opts)
}
