import React from 'react'
import { inject, observer } from 'mobx-react'
import { get, isEmpty } from 'lodash'

import NodeMonitoringStore from 'stores/monitoring/node'
import { getAreaChartOps } from 'utils/monitoring'
import { Controller as MonitoringController } from 'components/Cards/Monitoring'
import { SimpleArea } from 'components/Charts'

const MetricTypes = {
  gpu_utilisation: 'node_gpu_utilisation',
  gpu_memory_utilisation: 'node_gpu_memory_utilisation',
  gpu_allocated: 'node_gpu_allocated',
  gpu_power: 'node_gpu_power',
  gpu_temperature: 'node_gpu_temperature',
}

@inject('detailStore')
@observer
export default class GpuMonitoring extends React.Component {
  constructor(props) {
    super(props)
    const { cluster } = props.match.params
    this.monitorStore = new NodeMonitoringStore({ cluster })
  }

  get metrics() {
    return this.monitorStore.data
  }

  fetchData = params => {
    const { node } = this.props.match.params
    const { role = [] } = this.props.detailStore.detail || {}
    this.monitorStore.fetchMetrics({
      resources: [node],
      metrics: Object.values(MetricTypes),
      fillZero: !role.includes('edge'),
      ...params,
    })
  }

  getMonitoringCfgs = () => [
    {
      type: 'utilisation',
      title: 'GPU_USAGE',
      unit: '%',
      legend: ['GPU_USAGE'],
      data: get(this.metrics, `${MetricTypes.gpu_utilisation}.data.result`),
    },
    {
      type: 'utilisation',
      title: 'GPU_MEMORY_USAGE',
      unit: '%',
      legend: ['GPU_MEMORY_USAGE'],
      data: get(
        this.metrics,
        `${MetricTypes.gpu_memory_utilisation}.data.result`
      ),
    },
    {
      type: 'utilisation',
      title: 'GPU_ALLOCATION_RATIO',
      unit: '%',
      legend: ['GPU_ALLOCATION_RATIO'],
      data: get(this.metrics, `${MetricTypes.gpu_allocated}.data.result`),
    },
    {
      type: 'usage',
      title: 'GPU_POWER',
      unit: 'W',
      legend: ['GPU_POWER'],
      data: get(this.metrics, `${MetricTypes.gpu_power}.data.result`),
    },
    {
      type: 'usage',
      title: 'GPU_TEMPERATURE',
      unit: '°C',
      legend: ['GPU_TEMPERATURE'],
      data: get(this.metrics, `${MetricTypes.gpu_temperature}.data.result`),
    },
  ]

  render() {
    const { createTime } = this.props.detailStore.detail || {}
    const { isLoading, isRefreshing } = this.monitorStore
    const configs = this.getMonitoringCfgs()

    return (
      <MonitoringController
        createTime={createTime}
        onFetch={this.fetchData}
        loading={isLoading}
        refreshing={isRefreshing}
        isEmpty={isEmpty(this.metrics)}
      >
        <div style={{ marginBottom: 12, color: '#79879c', fontSize: 12 }}>
          {t('GPU_DETAIL_MONITORING_TIPS')}
        </div>
        {configs.map(item => {
          const config = getAreaChartOps(item)
          if (isEmpty(config.data)) return null
          return <SimpleArea key={config.title} width="100%" {...config} />
        })}
      </MonitoringController>
    )
  }
}
