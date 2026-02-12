import React from 'react'

import { Panel } from 'components/Base'
import * as styles from './index.scss'

const GPU_TOPOLOGY_LEGEND = {
  cambricon: [
    { code: 'X', descKey: 'GPU_TOPOLOGY_SELF' },
    {
      code: 'SGL',
      desc: 'all devices that only need traverse a single PCIe switch',
    },
    { code: 'MUL', desc: 'all devices that need not traverse a host bridge' },
    {
      code: 'H_B',
      desc: 'all devices that are connected to the same host bridge',
    },
    {
      code: 'CPU',
      desc:
        'all devices that are connected to the same CPU but possibly multiple host bridges',
    },
    { code: 'SYS', desc: 'all devices in the system' },
    { code: 'MLK#', desc: 'all devices in a bonded set of # MLU-Links' },
    {
      code: 'MLK[S]',
      desc: 'all devices that are connected to the same switch',
    },
  ],
  nvidia: [
    { code: 'X', descKey: 'GPU_TOPOLOGY_SELF' },
    {
      code: 'SYS',
      desc:
        'Connection traversing PCIe as well as the SMP interconnect between NUMA nodes (e.g., QPI/UPI)',
    },
    {
      code: 'NODE',
      desc:
        'Connection traversing PCIe as well as the interconnect between PCIe Host Bridges within a NUMA node',
    },
    {
      code: 'PHB',
      desc:
        'Connection traversing PCIe as well as a PCIe Host Bridge (typically the CPU)',
    },
    {
      code: 'PXB',
      desc:
        'Connection traversing multiple PCIe bridges (without traversing the PCIe Host Bridge)',
    },
    { code: 'PIX', desc: 'Connection traversing at most a single PCIe bridge' },
    { code: 'NV#', desc: 'Connection traversing a bonded set of # NVLinks' },
  ],
}

function getConnectivityTier(value) {
  if (value === undefined || value === null || value === '') return 'System'
  const s = String(value).trim()
  if (s === '-' || s === '') return 'System'
  if (s.toUpperCase() === 'X') return 'Self'
  if (/^NV\d+$/i.test(s) || s === 'NV#') return 'HighSpeed'
  if (/^MLK/i.test(s)) return 'HighSpeed'
  if (s === 'H_B' || s === 'SGL' || s === 'MUL') return 'HighSpeed'
  return 'System'
}

const TIER_ORDER = { HighSpeed: 0, Self: 1, System: 2 }

/**
 * Normalize a device name for fuzzy matching:
 * lowercase + strip all non-alphanumeric chars.
 * e.g. "GPU-0" -> "gpu0", "GPU0" -> "gpu0", "0" -> "0"
 */
function normalizeDeviceName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Resolve which device name in `deviceNames` matches the given highlight info.
 * Returns the actual deviceName string, or undefined if no match.
 */
function resolveHighlightDevice(deviceNames, highlightDevice, highlightIndex) {
  if (!deviceNames || deviceNames.length === 0) return undefined

  // 1. Exact match
  if (highlightDevice && deviceNames.includes(highlightDevice)) {
    return highlightDevice
  }

  // 2. Normalized match
  if (highlightDevice) {
    const norm = normalizeDeviceName(highlightDevice)
    const found = deviceNames.find(n => normalizeDeviceName(n) === norm)
    if (found) return found
  }

  // 3. Index-based fallback: try common patterns for the given index
  if (highlightIndex !== undefined && highlightIndex !== null) {
    const idx = String(highlightIndex)
    const candidates = [
      `GPU${idx}`,
      `gpu${idx}`,
      `GPU-${idx}`,
      `GPU_${idx}`,
      idx,
    ]
    for (const c of candidates) {
      const found = deviceNames.find(
        n => normalizeDeviceName(n) === normalizeDeviceName(c)
      )
      if (found) return found
    }
    // 4. Last resort: match by position index in sorted array
    const numIdx = Number(highlightIndex)
    if (
      Number.isInteger(numIdx) &&
      numIdx >= 0 &&
      numIdx < deviceNames.length
    ) {
      return deviceNames[numIdx]
    }
  }

  return undefined
}

export default function GpuTopology({
  nodeInfo,
  highlightDevice,
  highlightIndex,
}) {
  const gpuTopology = nodeInfo && nodeInfo.gpuTopology
  if (!Array.isArray(gpuTopology) || gpuTopology.length === 0) return null
  const firstRow = gpuTopology[0]
  if (!firstRow || typeof firstRow !== 'object') return null

  const deviceNames = Object.keys(firstRow).sort()
  const vendor = ((nodeInfo && nodeInfo.gpuVendor) || '').toLowerCase()
  const legendLines = GPU_TOPOLOGY_LEGEND[vendor] || GPU_TOPOLOGY_LEGEND.nvidia

  const resolved = resolveHighlightDevice(
    deviceNames,
    highlightDevice,
    highlightIndex
  )

  const tierBadgeClass = {
    Self: styles.gpuTopologyBadgeSelf,
    HighSpeed: styles.gpuTopologyBadgeHighSpeed,
    System: styles.gpuTopologyBadgeSystem,
  }

  const tierDotClass = {
    Self: styles.gpuTopologyLegendDotSelf,
    HighSpeed: styles.gpuTopologyLegendDotHighSpeed,
    System: styles.gpuTopologyLegendDotSystem,
  }

  // Build connection relation list for the highlighted device
  let connectionList = null
  if (resolved) {
    const rowIdx = deviceNames.indexOf(resolved)
    if (rowIdx >= 0 && gpuTopology[rowIdx]) {
      const row = gpuTopology[rowIdx]
      const items = deviceNames
        .filter(name => name !== resolved)
        .map(name => {
          const value = row[name] ?? '-'
          const tier = getConnectivityTier(value)
          return { peer: name, value, tier }
        })
        .sort((a, b) => {
          const orderDiff =
            (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9)
          if (orderDiff !== 0) return orderDiff
          return a.peer.localeCompare(b.peer)
        })

      if (items.length > 0) {
        connectionList = (
          <div className={styles.gpuConnectionList}>
            <div className={styles.gpuConnectionListTitle}>
              {t('GPU_TOPOLOGY_CONNECTIONS', { device: resolved })}
            </div>
            <div className={styles.gpuConnectionListGrid}>
              {items.map(({ peer, value, tier }) => (
                <div key={peer} className={styles.gpuConnectionListItem}>
                  <span className={styles.gpuConnectionListPeer}>{peer}</span>
                  <span
                    className={`${styles.gpuTopologyBadge} ${tierBadgeClass[tier]}`}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      }
    }
  }

  return (
    <Panel title={t('GPU_TOPOLOGY')}>
      {connectionList}

      <div className={styles.gpuTopologyWrap}>
        <table className={styles.gpuTopologyTable}>
          <thead>
            <tr>
              <th />
              {deviceNames.map(name => (
                <th
                  key={name}
                  className={
                    resolved && name === resolved
                      ? styles.gpuTopologyHighlightTh
                      : undefined
                  }
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gpuTopology.map((row, i) => {
              const rowDevice = deviceNames[i] ?? `[${i}]`
              const isHighlightRow = resolved && rowDevice === resolved
              return (
                <tr key={i}>
                  <th
                    className={
                      isHighlightRow ? styles.gpuTopologyHighlightTh : undefined
                    }
                  >
                    {rowDevice}
                  </th>
                  {deviceNames.map(name => {
                    const cellValue = row[name] ?? '-'
                    const tier = getConnectivityTier(cellValue)
                    const isCellEmpty =
                      cellValue === '-' ||
                      cellValue === undefined ||
                      cellValue === null ||
                      cellValue === ''
                    const isHighlightCol = resolved && name === resolved
                    const highlightTd =
                      isHighlightRow || isHighlightCol
                        ? styles.gpuTopologyHighlightTd
                        : undefined
                    return (
                      <td key={name} className={highlightTd}>
                        {isCellEmpty ? (
                          <span className={styles.gpuTopologyCellEmpty}>-</span>
                        ) : (
                          <span
                            className={`${styles.gpuTopologyBadge} ${tierBadgeClass[tier]}`}
                            title={tier}
                          >
                            {cellValue}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {legendLines.length > 0 && (
        <div className={styles.gpuTopologyLegend}>
          <div className={styles.gpuTopologyLegendTitle}>
            {t('GPU_TOPOLOGY_LEGEND_TITLE')}
          </div>
          <div className={styles.gpuTopologyLegendList}>
            {legendLines.map(({ code, desc, descKey }, idx) => {
              const tier = getConnectivityTier(code)
              const descText = descKey ? t(descKey) : desc
              return (
                <div key={idx} className={styles.gpuTopologyLegendItem}>
                  <span
                    className={`${styles.gpuTopologyLegendDot} ${tierDotClass[tier]}`}
                  />
                  <span className={styles.gpuTopologyLegendCode}>{code}</span>
                  <span className={styles.gpuTopologyLegendDesc}>
                    {descText}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Panel>
  )
}
