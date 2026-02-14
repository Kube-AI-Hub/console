import React from 'react'
import { inject, observer } from 'mobx-react'
import { toJS } from 'mobx'
import { get, isEmpty } from 'lodash'

import NodeMonitoringStore from 'stores/monitoring/node'
import { Panel, Text } from 'components/Base'
import MonitorTab from 'components/Cards/Monitoring/MonitorTab'
import TimeSelector from 'components/Cards/Monitoring/Controller/TimeSelector'
import GpuTopology from '../../RunningStatus/GpuTopology'
import * as styles from '../../RunningStatus/index.scss'

const GpuMetricTypes = [
  'gpu_card_utilisation',
  'gpu_card_memory_usage',
  'gpu_card_memory_total',
  'gpu_card_allocation_rate',
  'gpu_card_power',
  'gpu_card_temperature',
]

@inject('gpuDetailStore', 'detailStore')
@observer
export default class GpuRunningStatus extends React.Component {
  constructor(props) {
    super(props)
    const { cluster } = props.match.params
    this.monitorStore = new NodeMonitoringStore({ cluster })
    this.state = {
      step: '1m',
      times: 30,
      activeTab: 'gpu_usage',
    }
  }

  componentDidMount() {
    this.fetchMetrics()
  }

  componentDidUpdate(prevProps) {
    const { node, gpuUuid } = this.props.match.params
    const { node: prevNode, gpuUuid: prevGpuUuid } = prevProps.match.params
    if (node !== prevNode || gpuUuid !== prevGpuUuid) {
      this.fetchMetrics()
    }
  }

  fetchMetrics = () => {
    const { node, gpuUuid } = this.props.match.params
    const { role = [] } = this.props.detailStore.detail || {}
    const { step, times } = this.state
    this.monitorStore.fetchMetrics({
      resources: [node],
      metrics: GpuMetricTypes,
      step,
      times,
      fillZero: !role.includes('edge'),
      gpu_uuid: decodeURIComponent(gpuUuid || ''),
    })
  }

  handleTimeChange = ({ step, times }) => {
    this.setState({ step, times }, () => {
      this.fetchMetrics()
    })
  }

  handleTabChange = key => {
    this.setState({ activeTab: key })
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

  getMemoryTabTitle = tab => {
    const usageData = get(tab.data, '[0].values', [])
    const totalData = get(tab.extraData, '[0].values', [])
    if (isEmpty(usageData) || isEmpty(totalData)) return '-'
    const usage = Number(get(usageData, [usageData.length - 1, 1], 0))
    const total = Number(get(totalData, [totalData.length - 1, 1], 0))
    if (Number.isNaN(usage) || Number.isNaN(total)) return '-'
    const usageGiB = (usage / 1024 ** 3).toFixed(2)
    const pct = total > 0 ? ((usage / total) * 100).toFixed(1) : 0
    return `${usageGiB} GiB (${pct}%)`
  }

  renderResourceUsage() {
    const metrics = toJS(this.monitorStore.data)
    const { step, times, activeTab } = this.state
    return (
      <Panel
        className={styles.resources}
        title={
          <div className={styles.resourceUsageHeader}>
            <span>{t('RESOURCE_USAGE')}</span>
            <TimeSelector
              step={step}
              times={times}
              onChange={this.handleTimeChange}
              dark
              arrowIcon="chevron-down"
            />
          </div>
        }
        loading={this.monitorStore.isLoading}
      >
        <MonitorTab
          activeTab={activeTab}
          onTabChange={this.handleTabChange}
          tabs={[
            {
              key: 'gpu_usage',
              icon: 'gpu',
              unit: 'pct',
              unitSuffix: '%',
              legend: ['GPU_USAGE'],
              title: 'GPU_USAGE',
              data: get(metrics, 'gpu_card_utilisation.data.result'),
            },
            {
              key: 'gpu_memory',
              icon: 'memory',
              unitType: 'memory',
              legend: ['GPU_MEMORY_USAGE'],
              title: 'GPU_MEMORY_USAGE',
              data: get(metrics, 'gpu_card_memory_usage.data.result'),
              extraData: get(metrics, 'gpu_card_memory_total.data.result'),
              renderTitle: this.getMemoryTabTitle,
              yAxis: { hide: true },
            },
            {
              key: 'gpu_allocated',
              icon: 'pod',
              unit: '%',
              unitSuffix: '%',
              legend: ['GPU_ALLOCATION_RATIO'],
              title: 'GPU_ALLOCATION_RATIO',
              data: get(metrics, 'gpu_card_allocation_rate.data.result'),
            },
            {
              key: 'gpu_power',
              icon: 'gpu',
              unit: 'default',
              unitSuffix: ' W',
              legend: ['GPU_POWER'],
              title: 'GPU_POWER',
              data: get(metrics, 'gpu_card_power.data.result'),
              yAxis: { hide: true },
            },
            {
              key: 'gpu_temperature',
              icon: 'gpu',
              unit: 'default',
              unitSuffix: ' °C',
              legend: ['GPU_TEMPERATURE'],
              title: 'GPU_TEMPERATURE',
              data: get(metrics, 'gpu_card_temperature.data.result'),
              yAxis: { hide: true },
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
