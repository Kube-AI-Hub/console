import React from 'react'
import { toJS } from 'mobx'
import { inject, observer } from 'mobx-react'
import { get, isEmpty } from 'lodash'

import NodeMonitoringStore from 'stores/monitoring/node'
import {
  cpuFormat,
  memoryFormat,
  coreUnitTS,
  getVendorDisplayName,
} from 'utils'
import { Icon, Table, Tooltip } from '@kube-design/components'
import { Panel, Text, Status } from 'components/Base'
import MonitorTab from 'components/Cards/Monitoring/MonitorTab'
import { getValueByUnit, getSuitableUnit } from 'utils/monitoring'
import ConditionCard from './ConditionCard'
import TaintCard from './TaintCard'
import GpuTopology from './GpuTopology'
import * as styles from './index.scss'

const STANDARD_CAPACITY_KEYS = ['cpu', 'memory', 'pods', 'ephemeral-storage']

const STANDARD_CAPACITY_CONFIG = {
  cpu: { icon: 'cpu', titleKey: 'CPU_TOTAL_USAGE', format: 'cpu' },
  memory: { icon: 'memory', titleKey: 'MEMORY_TOTAL_USAGE', format: 'memory' },
  pods: { icon: 'pod', titleKey: 'POD_TOTAL_USAGE', format: 'count' },
  'ephemeral-storage': {
    icon: 'database',
    titleKey: 'EPHEMERAL_STORAGE',
    format: 'disk',
  },
}

function formatCapacityValue(value, config) {
  if (value === undefined || value === null || value === '') return '-'
  const fmt = config ? config.format : null
  if (fmt === 'cpu') return `${cpuFormat(value)} Core`
  if (fmt === 'memory' || fmt === 'disk')
    return `${memoryFormat(value, 'Gi')} Gi`
  if (fmt === 'gpuMemory') {
    const unit = (config && config.memoryUnit) || 'Mi'
    if (unit === 'Mi' || unit === 'Gi') {
      return `${memoryFormat(value, 'Gi')} Gi`
    }
    const num = memoryFormat(value, 'Mi')
    return isFinite(num) ? `${num} ${unit}` : `${String(value)} ${unit}`
  }
  if (fmt === 'count' || fmt === 'vcores') return String(value)
  if (fmt === 'countWithUnit') {
    const unit = (config && config.unit) || ''
    return unit ? `${String(value)} ${unit}` : String(value)
  }
  if (fmt === 'vcoresPercent') return `${String(value)}%`
  return String(value)
}

function parseNumericValue(value) {
  if (value === undefined || value === null || value === '') return NaN
  const cleaned = String(value).replace(/[^0-9.]/g, '')
  if (!cleaned || cleaned === '.') return NaN
  const parsed = Number(cleaned)
  return isFinite(parsed) ? parsed : NaN
}

function formatAllocatedWithPercent(value, allocatable, config) {
  const raw = formatCapacityValue(value, config)
  if (raw === '-' || !allocatable || isCapacityZero(allocatable)) return raw
  let pct
  const fmt = config ? config.format : null
  if (fmt === 'cpu') {
    const v = cpuFormat(value)
    const a = cpuFormat(allocatable)
    if (!isFinite(v) || !isFinite(a) || a === 0) return raw
    pct = Math.round((v / a) * 100)
  } else if (fmt === 'memory' || fmt === 'disk' || fmt === 'gpuMemory') {
    const v = memoryFormat(value, 'Mi')
    const a = memoryFormat(allocatable, 'Mi')
    if (!isFinite(v) || !isFinite(a) || a === 0) return raw
    pct = Math.round((v / a) * 100)
  } else if (
    fmt === 'count' ||
    fmt === 'vcores' ||
    fmt === 'countWithUnit' ||
    fmt === 'vcoresPercent'
  ) {
    const v = parseNumericValue(value)
    const a = parseNumericValue(allocatable)
    if (!isFinite(v) || !isFinite(a) || a === 0) return raw
    pct = Math.round((v / a) * 100)
  } else {
    const v = parseNumericValue(value)
    const a = parseNumericValue(allocatable)
    if (!isFinite(v) || !isFinite(a) || a === 0) return raw
    pct = Math.round((v / a) * 100)
  }
  return `${raw} (${pct}%)`
}

function isCapacityZero(value) {
  if (value === undefined || value === null || value === '') return true
  const s = String(value).trim()
  if (s === '0') return true
  if (/^0+\.?0*$/.test(s)) return true
  return false
}

function getOrderedCapacityRows(
  capacity,
  supportGpuType,
  supportGpuTypeMetadata
) {
  const rows = []
  const seen = new Set()
  const capacityKeys = Object.keys(capacity)

  STANDARD_CAPACITY_KEYS.forEach(key => {
    if (capacityKeys.includes(key)) {
      seen.add(key)
      const config = STANDARD_CAPACITY_CONFIG[key]
      rows.push({
        key,
        icon: config ? config.icon : 'database',
        description: t(`${config ? config.titleKey : key}_SCAP`),
        config,
        isGpuResource: false,
      })
    }
  })

  const gpuTypes = supportGpuType || []
  const metadata = supportGpuTypeMetadata || {}
  gpuTypes.forEach(resourceName => {
    const inCapacity = Object.prototype.hasOwnProperty.call(
      capacity,
      resourceName
    )
    const meta = metadata[resourceName] || {}
    const displayName = meta.displayName || resourceName
    if (inCapacity && !isCapacityZero(capacity[resourceName])) {
      seen.add(resourceName)
      rows.push({
        key: resourceName,
        icon: 'gpu',
        description: displayName,
        config: { format: 'countWithUnit', unit: t('GPU_CARD_UNIT') },
        isGpuResource: true,
        showAllocatedPercent: true,
      })
    } else if (inCapacity) {
      seen.add(resourceName)
    }
    const memoryName = meta.memoryName
    if (
      memoryName &&
      Object.prototype.hasOwnProperty.call(capacity, memoryName)
    ) {
      seen.add(memoryName)
      if (!isCapacityZero(capacity[memoryName])) {
        const memoryUnit = meta.memoryUnit || 'Mi'
        const memoryConfig =
          memoryUnit === 'Mi' || memoryUnit === 'Gi'
            ? { format: 'gpuMemory', memoryUnit }
            : { format: 'countWithUnit', unit: memoryUnit }
        rows.push({
          key: memoryName,
          icon: 'memory',
          description: `${displayName} ${t('GPU_MEMORY_TOTAL')}`,
          config: memoryConfig,
          isGpuResource: true,
        })
      }
    }
    const vcoresName = meta.vcoresName
    if (
      vcoresName &&
      Object.prototype.hasOwnProperty.call(capacity, vcoresName)
    ) {
      seen.add(vcoresName)
      if (!isCapacityZero(capacity[vcoresName])) {
        rows.push({
          key: vcoresName,
          icon: 'cpu',
          description: `${displayName} ${t('CORE_TOTAL_SCAP')}`,
          config: { format: 'vcoresPercent' },
          isGpuResource: true,
        })
      }
    }
  })

  capacityKeys.forEach(key => {
    if (!seen.has(key)) {
      if (isCapacityZero(capacity[key])) return
      rows.push({
        key: `other-${key}`,
        dataKey: key,
        icon: 'computing',
        description: key,
        config: null,
        isGpuResource: false,
      })
    }
  })

  return rows
}

function getResourceTotalGroups(
  capacity,
  nodeInfo,
  supportGpuType,
  supportGpuTypeMetadata,
  diskTitle
) {
  const row1 = []
  const row2 = []
  const row3 = []
  const capacityKeys = Object.keys(capacity)
  const gpuTypes = supportGpuType || []
  const metadata = supportGpuTypeMetadata || {}
  const gpuRelatedKeys = new Set(gpuTypes)
  gpuTypes.forEach(resourceName => {
    const meta = metadata[resourceName] || {}
    if (meta.memoryName) gpuRelatedKeys.add(meta.memoryName)
    if (meta.vcoresName) gpuRelatedKeys.add(meta.vcoresName)
  })

  const row1Order = [
    'cpu',
    'memory',
    'pods',
    'node_disk_size_capacity',
    'ephemeral-storage',
  ]
  row1Order.forEach(key => {
    if (key === 'node_disk_size_capacity') {
      row1.push({
        key: 'node_disk_size_capacity',
        icon: 'database',
        description: t('DISK_TOTAL_USAGE_SCAP'),
        title: diskTitle,
      })
      return
    }
    if (!capacityKeys.includes(key)) return
    const config = STANDARD_CAPACITY_CONFIG[key]
    row1.push({
      key,
      icon: config ? config.icon : 'database',
      description: t(`${config ? config.titleKey : key}_SCAP`),
      title: formatCapacityValue(capacity[key], config),
    })
  })

  const cardCount = get(nodeInfo, 'cardCount')
  if (cardCount !== undefined && cardCount !== null && cardCount !== '') {
    const n = Number(cardCount)
    row2.push({
      key: 'gpuCardCount',
      icon: 'gpu',
      description: t('GPU_TOTAL_SCAP'),
      title: `${isFinite(n) ? n : cardCount} ${t('GPU_CARD_UNIT')}`,
    })
  }

  const gpuMemoryTotal = get(nodeInfo, 'gpuMemoryTotal')
  if (
    gpuMemoryTotal !== undefined &&
    gpuMemoryTotal !== null &&
    gpuMemoryTotal !== ''
  ) {
    const value =
      typeof gpuMemoryTotal === 'number'
        ? `${gpuMemoryTotal}Mi`
        : String(gpuMemoryTotal)
    row2.push({
      key: 'gpuMemoryTotal',
      icon: 'memory',
      description: t('GPU_MEMORY_TOTAL_SCAP'),
      title: formatCapacityValue(value, {
        format: 'gpuMemory',
        memoryUnit: 'Mi',
      }),
    })
  }

  const virtualCardCount = get(nodeInfo, 'virtualCardCount')
  if (
    virtualCardCount !== undefined &&
    virtualCardCount !== null &&
    virtualCardCount !== ''
  ) {
    const n = Number(virtualCardCount)
    row2.push({
      key: 'virtualCardCount',
      icon: 'gpu',
      description: t('VGPU_TOTAL_SCAP'),
      title: `${isFinite(n) ? n : virtualCardCount} ${t('GPU_CARD_UNIT')}`,
    })
  }

  gpuTypes.forEach(resourceName => {
    const meta = metadata[resourceName] || {}
    const displayName = meta.displayName || resourceName
    if (
      Object.prototype.hasOwnProperty.call(capacity, resourceName) &&
      !isCapacityZero(capacity[resourceName])
    ) {
      row2.push({
        key: resourceName,
        icon: 'gpu',
        description: displayName,
        title: `${formatCapacityValue(capacity[resourceName], {
          format: 'count',
        })} ${t('GPU_CARD_UNIT')}`,
      })
    }
    const memoryName = meta.memoryName
    if (
      memoryName &&
      Object.prototype.hasOwnProperty.call(capacity, memoryName) &&
      !isCapacityZero(capacity[memoryName])
    ) {
      const memoryUnit = meta.memoryUnit || 'Mi'
      const memoryConfig =
        memoryUnit === 'Mi' || memoryUnit === 'Gi'
          ? { format: 'gpuMemory', memoryUnit }
          : { format: 'countWithUnit', unit: memoryUnit }
      row2.push({
        key: memoryName,
        icon: 'memory',
        description: `${displayName} ${t('GPU_MEMORY_TOTAL')}`,
        title: formatCapacityValue(capacity[memoryName], memoryConfig),
      })
    }
    const vcoresName = meta.vcoresName
    if (
      vcoresName &&
      Object.prototype.hasOwnProperty.call(capacity, vcoresName) &&
      !isCapacityZero(capacity[vcoresName])
    ) {
      row2.push({
        key: vcoresName,
        icon: 'cpu',
        description: `${displayName} ${t('CORE_TOTAL_SCAP')}`,
        title: formatCapacityValue(capacity[vcoresName], {
          format: 'vcoresPercent',
        }),
      })
    }
  })

  const gpuPrefixes = new Set()
  gpuTypes.forEach(resourceName => {
    const idx = resourceName.indexOf('/')
    if (idx !== -1) {
      gpuPrefixes.add(resourceName.substring(0, idx + 1))
    }
  })

  const standardCapacityKeys = ['cpu', 'memory', 'pods', 'ephemeral-storage']
  const keysForRow3 = []
  capacityKeys.forEach(key => {
    if (standardCapacityKeys.includes(key)) return
    if (gpuRelatedKeys.has(key)) return
    if (isCapacityZero(capacity[key])) return
    const matchesGpuPrefix = [...gpuPrefixes].some(prefix =>
      key.startsWith(prefix)
    )
    if (matchesGpuPrefix) {
      row2.push({
        key: `gpu-${key}`,
        icon: 'gpu',
        description: key,
        title: formatCapacityValue(capacity[key], null),
      })
    } else {
      keysForRow3.push(key)
    }
  })

  keysForRow3.forEach(key => {
    row3.push({
      key: `other-${key}`,
      icon: 'computing',
      description: key,
      title: formatCapacityValue(capacity[key], null),
    })
  })

  return { row1, row2, row3 }
}

const METRIC_TYPES = [
  'node_gpu_utilisation',
  'node_gpu_memory_utilisation',
  'node_cpu_utilisation',
  'node_memory_utilisation',
  'node_disk_size_utilisation',
  'node_pod_utilisation',
  'node_gpu_total',
  'node_gpu_memory_total',
  'node_gpu_allocated',
  'node_cpu_total',
  'node_memory_total',
  'node_pod_quota',
  'node_disk_size_capacity',
]

export default
@inject('detailStore')
@observer
class RunningStatus extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      gpulist: [],
    }
    this.store = props.detailStore
    this.monitoringStore = new NodeMonitoringStore({ cluster: this.cluster })
  }

  get cluster() {
    return this.props.match.params.cluster
  }

  componentDidMount() {
    this.fetchData()
    this.fetchGpuData()
  }

  fetchGpuData = async () => {
    const params = {
      conditions: `nodeName=${this.store.detail.name}`,
    }
    try {
      const result = await request.get(
        `/kapis/gpu.kubesphere.io/v1alpha1/gpus`,
        params
      )
      this.setState({
        gpulist: Array.isArray(result) ? result : [],
      })
    } catch (e) {
      this.setState({ gpulist: [] })
    }
  }

  fetchData() {
    const { name, role = [] } = this.store.detail

    this.monitoringStore.fetchMetrics({
      resources: [name],
      metrics: METRIC_TYPES,
      step: '180s',
      fillZero: !role.includes('edge'),
    })
  }

  getLastValue = (type, unit, unitType) => {
    const metricsData = this.monitoringStore.data
    const metrics = get(metricsData, `${type}.data.result`) || []
    const values = get(metrics, '[0].values', [])
    const lastValue = values.length > 0 ? values[values.length - 1] : [0, 0]
    const value = parseFloat(get(lastValue, '[1]', 0))

    // For GPU count, display raw value without unit conversion
    if (unitType === 'gpu') {
      return `${Math.round(value)} ${unit}`
    }

    const unitValue = unitType ? getSuitableUnit(values, unitType) : ''
    const unitText = unitValue ? coreUnitTS(values, unitValue) : ''
    return `${getValueByUnit(value, unit)} ${unitText}`
  }

  renderResourceTotalStatus() {
    const { detail } = this.store
    const capacity = get(detail, 'status.capacity') || {}
    const capacityKeys = Object.keys(capacity)
    const hasCapacity = capacityKeys.length > 0

    const supportGpuType = get(globals, 'config.supportGpuType', [])
    const supportGpuTypeMetadata = get(
      globals,
      'config.supportGpuTypeMetadata',
      {}
    )
    const nodeInfo = get(detail, 'status.nodeInfo') || {}
    const diskTitle = this.getLastValue('node_disk_size_capacity', 'TB', 'disk')
    const { row1, row2, row3 } = getResourceTotalGroups(
      capacity,
      nodeInfo,
      supportGpuType,
      supportGpuTypeMetadata,
      diskTitle
    )

    const useMetrics = !hasCapacity
    if (useMetrics) {
      const tabs = [
        {
          key: 'node_gpu_total',
          icon: 'gpu',
          unitType: 'gpu',
          unit: t('GPU_CARD_UNIT'),
          title: 'GPU_TOTAL',
        },
        {
          key: 'node_gpu_memory_total',
          icon: 'memory',
          unitType: 'memory',
          unit: 'Gi',
          title: 'GPU_MEMORY_TOTAL',
        },
        {
          key: 'node_cpu_total',
          icon: 'cpu',
          unitType: 'cpu',
          unit: 'Core',
          title: 'CPU_TOTAL_USAGE',
        },
        {
          key: 'node_memory_total',
          icon: 'memory',
          unitType: 'memory',
          unit: 'Gi',
          title: 'MEMORY_TOTAL_USAGE',
        },
        { key: 'node_pod_quota', icon: 'pod', title: 'POD_TOTAL_USAGE' },
        {
          key: 'node_disk_size_capacity',
          icon: 'database',
          unitType: 'disk',
          unit: 'TB',
          title: 'DISK_TOTAL_USAGE',
        },
      ]
      return (
        <Panel
          className={styles.resourcestotal}
          title={t('RESOURCE_TOTAL')}
          loading={this.monitoringStore.isLoading}
        >
          {tabs.map(tab => (
            <div className={styles.tabResourcesItem} key={tab.key}>
              <Text
                icon={tab.icon}
                title={this.getLastValue(tab.key, tab.unit, tab.unitType)}
                description={t(`${tab.title}_SCAP`)}
              />
            </div>
          ))}
        </Panel>
      )
    }

    return (
      <Panel
        className={styles.resourcestotal}
        title={t('RESOURCE_TOTAL')}
        loading={this.monitoringStore.isLoading}
      >
        <div className={styles.resourceTotalRow1}>
          {row1.map(item => (
            <div className={styles.tabResourcesItem} key={item.key}>
              <Text
                icon={item.icon}
                title={item.title}
                description={item.description}
              />
            </div>
          ))}
        </div>
        {row2.length > 0 && (
          <div className={styles.resourceTotalRow2}>
            {row2.map(item => (
              <div className={styles.tabResourcesItem} key={item.key}>
                <Text
                  icon={item.icon}
                  title={item.title}
                  description={item.description}
                />
              </div>
            ))}
          </div>
        )}
        {row3.length > 0 && (
          <div className={styles.resourceTotalRow3}>
            {row3.map(item => (
              <div className={styles.tabResourcesItem} key={item.key}>
                <Text
                  icon={item.icon}
                  title={item.title}
                  description={item.description}
                />
              </div>
            ))}
          </div>
        )}
      </Panel>
    )
  }

  renderResourceStatus() {
    const metrics = toJS(this.monitoringStore.data)
    return (
      <Panel
        className={styles.resources}
        title={t('RESOURCE_USAGE')}
        loading={this.monitoringStore.isLoading}
      >
        <MonitorTab
          tabs={[
            {
              key: 'gpu',
              icon: 'gpu',
              unit: '%',
              legend: ['GPU_USAGE'],
              title: 'GPU_USAGE',
              data: get(metrics, 'node_gpu_utilisation.data.result'),
            },
            {
              key: 'gpu_memory',
              icon: 'memory',
              unit: '%',
              legend: ['GPU_MEMORY_USAGE'],
              title: 'GPU_MEMORY_USAGE',
              data: get(metrics, 'node_gpu_memory_utilisation.data.result'),
            },
            {
              key: 'cpu',
              icon: 'cpu',
              unit: '%',
              legend: ['CPU_USAGE'],
              title: 'CPU_USAGE',
              data: get(metrics, 'node_cpu_utilisation.data.result'),
            },
            {
              key: 'memory',
              icon: 'memory',
              unit: '%',
              legend: ['MEMORY_USAGE'],
              title: 'MEMORY_USAGE',
              data: get(metrics, 'node_memory_utilisation.data.result'),
            },
            {
              key: 'pod',
              icon: 'pod',
              unit: '%',
              legend: ['MAXIMUM_PODS'],
              title: 'MAXIMUM_PODS',
              data: get(metrics, 'node_pod_utilisation.data.result'),
            },
            {
              key: 'storage',
              icon: 'database',
              unit: '%',
              legend: ['DISK_USAGE'],
              title: 'DISK_USAGE',
              data: get(metrics, 'node_disk_size_utilisation.data.result'),
            },
          ]}
        />
      </Panel>
    )
  }

  renderAllocatedResources() {
    const { detail } = this.store
    const capacity = get(detail, 'status.capacity') || {}
    const allocated = get(detail, 'status.allocated') || {}
    const allocatedLimits = get(detail, 'status.allocatedLimits') || {}
    const allocatable = get(detail, 'status.allocatable') || {}
    const hasAllocated = Object.keys(allocated).length > 0

    if (hasAllocated) {
      const supportGpuType = get(globals, 'config.supportGpuType', [])
      const supportGpuTypeMetadata = get(
        globals,
        'config.supportGpuTypeMetadata',
        {}
      )
      // Merge allocated/allocatedLimits keys into capacity so resources with
      // non-zero allocations are always visible even when capacity is 0 or absent
      const mergedCapacity = { ...capacity }
      ;[allocated, allocatedLimits].forEach(src => {
        Object.keys(src).forEach(key => {
          if (
            !Object.prototype.hasOwnProperty.call(mergedCapacity, key) ||
            isCapacityZero(mergedCapacity[key])
          ) {
            if (!isCapacityZero(src[key])) {
              mergedCapacity[key] = src[key]
            }
          }
        })
      })
      const rowSpecs = getOrderedCapacityRows(
        mergedCapacity,
        supportGpuType,
        supportGpuTypeMetadata
      )
      const limits =
        Object.keys(allocatedLimits).length > 0 ? allocatedLimits : allocated
      const tableData = rowSpecs.map(row => {
        const dataKey = row.dataKey !== undefined ? row.dataKey : row.key
        const reqVal = allocated[dataKey]
        const limVal = limits[dataKey] !== undefined ? limits[dataKey] : reqVal
        const allocVal = allocatable[dataKey]
        const formatCell = val =>
          val !== undefined &&
          val !== null &&
          val !== '' &&
          !isCapacityZero(val)
            ? formatCapacityValue(val, row.config)
            : '-'
        const requestsCell =
          row.showAllocatedPercent === false
            ? formatCell(reqVal)
            : formatAllocatedWithPercent(reqVal, allocVal, row.config)
        const limitsCell =
          row.showAllocatedPercent === false
            ? formatCell(limVal)
            : formatAllocatedWithPercent(limVal, allocVal, row.config)
        return {
          key: row.key,
          icon: row.icon,
          resource: row.description,
          requests: requestsCell,
          limits: limitsCell,
        }
      })
      return (
        <Panel className={styles.allocated} title={t('ALLOCATED_RESOURCES')}>
          <div className={styles.allocatedTableWrap}>
            <table className={styles.allocatedTable}>
              <thead>
                <tr>
                  <th>{t('RESOURCE')}</th>
                  <th>{t('REQUESTS')}</th>
                  <th>{t('LIMITS')}</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map(row => (
                  <tr key={row.key}>
                    <td className={styles.allocatedTableResourceCell}>
                      <Icon name={row.icon} size={20} />
                      <span>{row.resource}</span>
                    </td>
                    <td>{row.requests}</td>
                    <td>{row.limits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.allocatedTableNote}>
            {t('ALLOCATED_RESOURCES_OVERCOMMIT_TIP')}
          </div>
        </Panel>
      )
    }

    const allocCpu = get(
      detail,
      'annotations["node.kubesphere.io/cpu-requests"]'
    )
    const allocMem = get(
      detail,
      'annotations["node.kubesphere.io/memory-requests"]'
    )
    const allocCpuFrac = get(
      detail,
      'annotations["node.kubesphere.io/cpu-requests-fraction"]'
    )
    const allocMemFrac = get(
      detail,
      'annotations["node.kubesphere.io/memory-requests-fraction"]'
    )
    return (
      <Panel className={styles.allocated} title={t('ALLOCATED_RESOURCES')}>
        <Text
          title={this.getLastValue(
            'node_gpu_allocated',
            t('GPU_CARD_UNIT'),
            'gpu'
          )}
          description={t('GPU_REQUEST_SCAP')}
        />
        <Text
          title={
            cpuFormat(allocCpu) === 1
              ? t('CPU_CORE_PERCENT_SI', {
                  core: cpuFormat(allocCpu),
                  percent: allocCpuFrac,
                })
              : t('CPU_CORE_PERCENT_PL', {
                  core: cpuFormat(allocCpu),
                  percent: allocCpuFrac,
                })
          }
          description={t('CPU_REQUEST_SCAP')}
        />
        <Text
          title={
            cpuFormat(
              get(detail, 'annotations["node.kubesphere.io/cpu-limits"]')
            ) === 1
              ? t('CPU_CORE_PERCENT_SI', {
                  core: cpuFormat(
                    get(detail, 'annotations["node.kubesphere.io/cpu-limits"]')
                  ),
                  percent: get(
                    detail,
                    'annotations["node.kubesphere.io/cpu-limits-fraction"]'
                  ),
                })
              : t('CPU_CORE_PERCENT_PL', {
                  core: cpuFormat(
                    get(detail, 'annotations["node.kubesphere.io/cpu-limits"]')
                  ),
                  percent: get(
                    detail,
                    'annotations["node.kubesphere.io/cpu-limits-fraction"]'
                  ),
                })
          }
          description={t('CPU_LIMIT_SCAP')}
        />
        <Text
          title={t('MEMORY_GIB_PERCENT', {
            gib: memoryFormat(allocMem, 'Gi'),
            percent: allocMemFrac,
          })}
          description={t('MEMORY_REQUEST_SCAP')}
        />
        <Text
          title={t('MEMORY_GIB_PERCENT', {
            gib: memoryFormat(
              get(detail, 'annotations["node.kubesphere.io/memory-limits"]'),
              'Gi'
            ),
            percent: get(
              detail,
              'annotations["node.kubesphere.io/memory-limits-fraction"]'
            ),
          })}
          description={t('MEMORY_LIMIT_SCAP')}
        />
      </Panel>
    )
  }

  renderConditions() {
    const { conditions } = this.store.detail

    return (
      <Panel title={t('HEALTH_STATUS')}>
        <div className={styles.conditions}>
          {conditions.map((condition, i) => (
            <ConditionCard key={condition.type || i} data={condition} />
          ))}
        </div>
      </Panel>
    )
  }

  renderTanits() {
    const { taints } = this.store.detail

    if (isEmpty(taints)) return null

    return (
      <Panel title={t('TAINTS')} empty={t('NO_TAINTS_TIPS')}>
        {taints && (
          <div>
            {taints.map((taint, i) => (
              <TaintCard key={taint.type || i} data={taint} />
            ))}
          </div>
        )}
      </Panel>
    )
  }

  renderGpuCardList() {
    const tableProps = {
      isLoading: false,
      dataSource: this.state.gpulist,
      rowKey: 'uuid',
    }
    const columns = [
      {
        title: t('GPU_CARD_INDEX'),
        key: 'index',
        isHideable: true,
        width: '5%',
        render: record => record.index,
      },
      {
        title: t('GPU_CARD_ID'),
        key: 'uuid',
        isHideable: true,
        width: '10%',
        overFlow: 'ellipsis',
        render: record => {
          return (
            <Tooltip content={record.uuid}>
              <span
                style={{
                  display: 'inline-block',
                  width: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {record.uuid}
              </span>
            </Tooltip>
          )
        },
      },
      {
        title: t('GPU_CARD_STATUS'),
        key: 'health',
        isHideable: true,
        render: (_, record) => {
          return (
            <Status
              type={record.health ? 'Running' : 'Warning'}
              name={record.health ? t('HEALTHY') : t('SUB_HEALTHY')}
            />
          )
        },
      },
      {
        title: t('GPU_CARD_MODEL'),
        key: 'type',
        isHideable: true,
        render: record => record.type,
      },
      {
        title: t('GPU_CARD_NUMA'),
        key: 'numa',
        isHideable: true,
        render: record =>
          record.numa !== undefined && record.numa !== null ? record.numa : '-',
      },
      {
        title: t('GPU_CARD_VENDOR'),
        key: 'deviceVendor',
        isHideable: true,
        render: record => getVendorDisplayName(record.deviceVendor) || '-',
      },
      {
        title: t('GPU_CARD_MODE'),
        key: 'mode',
        isHideable: true,
        render: record =>
          record.mode
            ? record.mode === 'default'
              ? t('GPU_MODE_DEFAULT')
              : record.mode
            : '-',
      },
      {
        title: t('GPU_CARD_VGPU'),
        key: 'vgpuUsed',
        isHideable: true,
        render: record => `${record.vgpuUsed}/${record.vgpuTotal}`,
      },
      {
        title: t('GPU_CARD_COMPUTE'),
        key: 'gpuCoreTotal',
        isHideable: true,
        render: record => `${record.gpuCoreUsed}/${record.gpuCoreTotal}`,
      },
      {
        title: t('GPU_CARD_MEMORY'),
        key: 'gpuMemoryTotal',
        isHideable: true,
        render: record => {
          // convert to GiB and round to 2 decimal places
          const gpuMemoryTotal = (record.gpuMemoryTotal / 1024).toFixed(2)
          const gpuMemoryUsed = (record.gpuMemoryUsed / 1024).toFixed(2)
          return `${gpuMemoryUsed}/${gpuMemoryTotal} GiB`
        },
      },
    ]
    return (
      <Panel title={t('GPU_CARD_LIST')} empty={t('NO_GPU_TIPS')}>
        <Table
          rowKey="uuid"
          dataSource={tableProps.dataSource}
          className={'table-2-6 table-4-3'}
          columns={columns}
          isLoading={tableProps.isLoading}
          emptyText={t('NO_GPU_TIPS')}
        />
      </Panel>
    )
  }

  renderGpuTopology() {
    const detail = toJS(this.store.detail)
    const nodeInfo = detail.nodeInfo || get(detail, 'status.nodeInfo') || {}
    return <GpuTopology nodeInfo={nodeInfo} />
  }

  render() {
    return (
      <div className={styles.main}>
        {this.renderResourceTotalStatus()}
        {this.renderResourceStatus()}
        {this.renderAllocatedResources()}
        {this.renderConditions()}
        {this.renderTanits()}
        {this.renderGpuCardList()}
        {this.renderGpuTopology()}
      </div>
    )
  }
}
