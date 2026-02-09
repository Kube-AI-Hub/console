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

export default function GpuTopology({ nodeInfo }) {
  const gpuTopology = nodeInfo && nodeInfo.gpuTopology
  if (!Array.isArray(gpuTopology) || gpuTopology.length === 0) return null
  const firstRow = gpuTopology[0]
  if (!firstRow || typeof firstRow !== 'object') return null

  const deviceNames = Object.keys(firstRow).sort()
  const vendor = ((nodeInfo && nodeInfo.gpuVendor) || '').toLowerCase()
  const legendLines = GPU_TOPOLOGY_LEGEND[vendor] || GPU_TOPOLOGY_LEGEND.nvidia

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

  return (
    <Panel title={t('GPU_TOPOLOGY')}>
      <div className={styles.gpuTopologyWrap}>
        <table className={styles.gpuTopologyTable}>
          <thead>
            <tr>
              <th />
              {deviceNames.map(name => (
                <th key={name}>{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gpuTopology.map((row, i) => (
              <tr key={i}>
                <th>{deviceNames[i] ?? `[${i}]`}</th>
                {deviceNames.map(name => {
                  const cellValue = row[name] ?? '-'
                  const tier = getConnectivityTier(cellValue)
                  const isEmpty =
                    cellValue === '-' ||
                    cellValue === undefined ||
                    cellValue === null ||
                    cellValue === ''
                  return (
                    <td key={name}>
                      {isEmpty ? (
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
            ))}
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
