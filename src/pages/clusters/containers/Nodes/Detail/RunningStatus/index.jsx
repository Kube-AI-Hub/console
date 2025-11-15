import React from 'react'
import { toJS } from 'mobx'
import { inject, observer } from 'mobx-react'
import { get, isEmpty } from 'lodash'

import NodeMonitoringStore from 'stores/monitoring/node'
import { cpuFormat, memoryFormat, coreUnitTS } from 'utils'
import { Table, Tooltip } from '@kube-design/components'
import { Panel, Text, Status } from 'components/Base'
import MonitorTab from 'components/Cards/Monitoring/MonitorTab'
import { getValueByUnit, getSuitableUnit } from 'utils/monitoring'
import ConditionCard from './ConditionCard'
import TaintCard from './TaintCard'
import * as styles from './index.scss'

const METRIC_TYPES = [
  'node_gpu_utilisation',
  'node_gpu_memory_utilisation',
  'node_cpu_utilisation',
  'node_memory_utilisation',
  'node_disk_size_utilisation',
  'node_pod_utilisation',
  'node_gpu_total',
  'node_gpu_memory_total',
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
    const result = await request.get(
      `/kapis/gpu.kubesphere.io/v1alpha1/gpus`,
      params
    )
    this.setState({
      gpulist: result.items,
    })
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
    const unitValue = unitType ? getSuitableUnit(values, unitType) : ''
    const unitText = unitValue ? coreUnitTS(values, unitValue) : ''
    return `${getValueByUnit(get(values, '[0][1]', 0), unit)} ${unitText}`
  }

  renderResourceTotalStatus() {
    // const metrics = toJS(this.monitoringStore.data)
    const tabs = [
      {
        key: 'node_gpu_total',
        icon: 'cpu',
        unitType: 'cpu',
        unit: 'Core',
        legend: ['GPU_USAGE'],
        title: 'GPU_TOTAL_USAGE',
      },
      {
        key: 'node_gpu_memory_total',
        icon: 'memory',
        unitType: 'memory',
        unit: 'Gi',
        legend: ['GPU_MEMORY_USAGE'],
        title: 'GPU_MEMORY_TOTAL_USAGE',
      },
      {
        key: 'node_cpu_total',
        icon: 'cpu',
        unitType: 'cpu',
        unit: 'Core',
        legend: ['CPU_USAGE'],
        title: 'CPU_TOTAL_USAGE',
      },
      {
        key: 'node_memory_total',
        icon: 'memory',
        unitType: 'memory',
        unit: 'Gi',
        title: 'MEMORY_TOTAL_USAGE',
      },
      {
        key: 'node_pod_quota',
        icon: 'pod',
        title: 'POD_TOTAL_USAGE',
      },
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
        title={t('RESOURCE_TOTAL_USAGE')}
        loading={this.monitoringStore.isLoading}
      >
        {tabs.map(tab => (
          <div className={styles.tabResourcesItem} key={tab.key}>
            <Text
              icon={tab.icon}
              key={tab.key}
              title={this.getLastValue(tab.key, tab.unit, tab.unitType)}
              description={t(`${tab.title}_SCAP`)}
            />
          </div>
        ))}
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
              icon: 'cpu',
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
    return (
      <Panel className={styles.allocated} title={t('ALLOCATED_RESOURCES')}>
        <Text
          title={
            cpuFormat(
              get(detail, 'annotations["node.kubesphere.io/cpu-requests"]')
            ) === 1
              ? t('CPU_CORE_PERCENT_SI', {
                  core: cpuFormat(
                    get(
                      detail,
                      'annotations["node.kubesphere.io/cpu-requests"]'
                    )
                  ),
                  percent: get(
                    detail,
                    'annotations["node.kubesphere.io/cpu-requests-fraction"]'
                  ),
                })
              : t('CPU_CORE_PERCENT_PL', {
                  core: cpuFormat(
                    get(
                      detail,
                      'annotations["node.kubesphere.io/cpu-requests"]'
                    )
                  ),
                  percent: get(
                    detail,
                    'annotations["node.kubesphere.io/cpu-requests-fraction"]'
                  ),
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
            gib: memoryFormat(
              get(detail, 'annotations["node.kubesphere.io/memory-requests"]'),
              'Gi'
            ),
            percent: get(
              detail,
              'annotations["node.kubesphere.io/memory-requests-fraction"]'
            ),
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
        <Text
          title={`${cpuFormat(
            get(detail, 'annotations["node.kubesphere.io/gpu-requests"]')
          )} 核`}
          description={t('GPU_REQUEST_SCAP')}
        />
        <Text
          title={`${memoryFormat(
            get(
              detail,
              'annotations["node.kubesphere.io/gpu-memory-requests"]'
            ),
            'Gi'
          )} GiB`}
          description={t('GPU_MEMORY_REQUEST_SCAP')}
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

  render() {
    return (
      <div className={styles.main}>
        {this.renderResourceTotalStatus()}
        {this.renderResourceStatus()}
        {this.renderAllocatedResources()}
        {this.renderConditions()}
        {this.renderTanits()}
        {this.renderGpuCardList()}
      </div>
    )
  }
}
