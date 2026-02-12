import React from 'react'
import { inject, observer } from 'mobx-react'
import { toJS } from 'mobx'
import { get, isEmpty } from 'lodash'

import NodeMonitoringStore from 'stores/monitoring/node'
import { Panel, Text } from 'components/Base'
import MonitorTab from 'components/Cards/Monitoring/MonitorTab'
import GpuTopology from '../../RunningStatus/GpuTopology'
import * as styles from '../../RunningStatus/index.scss'

const GpuMetricTypes = [
  'node_gpu_utilisation',
  'node_gpu_memory_utilisation',
  'node_gpu_allocated',
  'node_gpu_power',
  'node_gpu_temperature',
]

@inject('gpuDetailStore', 'detailStore')
@observer
export default class GpuRunningStatus extends React.Component {
  constructor(props) {
    super(props)
    const { cluster } = props.match.params
    this.monitorStore = new NodeMonitoringStore({ cluster })
  }

  componentDidMount() {
    this.fetchMetrics()
  }

  componentDidUpdate(prevProps) {
    const { node } = this.props.match.params
    const { node: prevNode } = prevProps.match.params
    if (node !== prevNode) {
      this.fetchMetrics()
    }
  }

  fetchMetrics = () => {
    const { node } = this.props.match.params
    const { role = [] } = this.props.detailStore.detail || {}
    this.monitorStore.fetchMetrics({
      resources: [node],
      metrics: GpuMetricTypes,
      step: '1m',
      times: 30,
      fillZero: !role.includes('edge'),
    })
  }

  renderSummary() {
    const detail = toJS(this.props.gpuDetailStore.detail)
    if (isEmpty(detail)) return null

    const gpuMemTotal = Number(get(detail, 'gpuMemoryTotal', 0))
    const gpuMemUsed = Number(get(detail, 'gpuMemoryUsed', 0))
    const gpuCoreTotal = Number(get(detail, 'gpuCoreTotal', 0))
    const gpuCoreUsed = Number(get(detail, 'gpuCoreUsed', 0))
    const vgpuTotal = Number(get(detail, 'vgpuTotal', 0))
    const vgpuUsed = Number(get(detail, 'vgpuUsed', 0))

    return (
      <Panel title={t('GPU_CARD_SUMMARY')}>
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          <div className={styles.tabResourcesItem}>
            <Text
              icon="gpu"
              title={`${gpuCoreUsed}/${gpuCoreTotal}`}
              description={t('GPU_CARD_COMPUTE')}
            />
          </div>
          <div className={styles.tabResourcesItem}>
            <Text
              icon="memory"
              title={`${(gpuMemUsed / 1024).toFixed(2)}/${(
                gpuMemTotal / 1024
              ).toFixed(2)} GiB`}
              description={t('GPU_CARD_MEMORY')}
            />
          </div>
          <div className={styles.tabResourcesItem}>
            <Text
              icon="pod"
              title={`${vgpuUsed}/${vgpuTotal}`}
              description={t('GPU_CARD_VGPU')}
            />
          </div>
        </div>
      </Panel>
    )
  }

  renderResourceUsage() {
    const metrics = toJS(this.monitorStore.data)
    return (
      <Panel
        className={styles.resources}
        title={t('RESOURCE_USAGE')}
        loading={this.monitorStore.isLoading}
      >
        <MonitorTab
          tabs={[
            {
              key: 'gpu_usage',
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
              key: 'gpu_allocated',
              icon: 'pod',
              unit: '%',
              legend: ['GPU_ALLOCATION_RATIO'],
              title: 'GPU_ALLOCATION_RATIO',
              data: get(metrics, 'node_gpu_allocated.data.result'),
            },
            {
              key: 'gpu_power',
              icon: 'gpu',
              unit: 'W',
              legend: ['GPU_POWER'],
              title: 'GPU_POWER',
              data: get(metrics, 'node_gpu_power.data.result'),
            },
            {
              key: 'gpu_temperature',
              icon: 'gpu',
              unit: '°C',
              legend: ['GPU_TEMPERATURE'],
              title: 'GPU_TEMPERATURE',
              data: get(metrics, 'node_gpu_temperature.data.result'),
            },
          ]}
        />
      </Panel>
    )
  }

  renderGpuTopology() {
    const nodeDetail = toJS(this.props.detailStore.detail)
    const nodeInfo =
      get(nodeDetail, 'nodeInfo') || get(nodeDetail, 'status.nodeInfo') || {}
    const gpuDetail = toJS(this.props.gpuDetailStore.detail)
    const gpuIndex = get(gpuDetail, 'index')
    const highlightDevice =
      gpuIndex !== undefined ? `GPU${gpuIndex}` : undefined
    return (
      <GpuTopology
        nodeInfo={nodeInfo}
        highlightDevice={highlightDevice}
        highlightIndex={gpuIndex}
      />
    )
  }

  render() {
    return (
      <div>
        {this.renderSummary()}
        {this.renderResourceUsage()}
        {this.renderGpuTopology()}
      </div>
    )
  }
}
