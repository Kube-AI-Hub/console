/*
 * Copyright (C) 2026 Kube AI Hub.
 *
 * KubeSphere Console is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * KubeSphere Console is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with KubeSphere Console.  If not, see <https://www.gnu.org/licenses/>.
 */

import React from 'react'
import { observer } from 'mobx-react'
import { get, isEmpty } from 'lodash'
import { Select, Loading } from '@kube-design/components'
import { Controller as MonitoringController } from 'components/Cards/Monitoring'
import { SimpleArea } from 'components/Charts'
import { getAreaChartOps, getAdaptedStep } from 'utils/monitoring'
import { getVendorDisplayName } from 'utils'
import GpuStore from 'stores/gpu'

@observer
class GPUPhysicalMonitoring extends React.Component {
  constructor(props) {
    super(props)
    this.gpuStore = new GpuStore()
    this.state = {
      vendorOptions: [],
      modelOptions: [],
      selectedVendor: '',
      selectedModel: '',
      metrics: {},
      loading: false,
    }
  }

  get cluster() {
    return this.props.cluster || get(this.props, 'match.params.cluster')
  }

  get apiPath() {
    return globals.app.isMultiCluster
      ? `/kapis/clusters/${this.cluster}/gpu.kubesphere.io/v1alpha1`
      : '/kapis/gpu.kubesphere.io/v1alpha1'
  }

  componentDidMount() {
    this.loadStatsOptions()
  }

  loadStatsOptions = async () => {
    try {
      const result = await request.get(`${this.apiPath}/gpus/stats`)
      const stats = typeof result === 'object' && result !== null ? result : {}
      const vendorSet = new Set()
      const modelSet = new Set()
      Object.keys(stats).forEach(key => {
        if (key === 'total' || key === 'healthy') return
        const [v, m] =
          key.split('-').length >= 2
            ? [
                key.split('-')[0],
                key
                  .split('-')
                  .slice(1)
                  .join('-'),
              ]
            : [key, '-']
        vendorSet.add(v)
        modelSet.add(`${v}|${m}`)
      })
      const vendorOptions = Array.from(vendorSet)
        .sort()
        .map(v => ({
          value: v,
          label: getVendorDisplayName(v) || v,
        }))
      const modelOptions = Array.from(modelSet)
        .sort()
        .map(pair => {
          const [v, m] = pair.split('|')
          return {
            value: pair,
            label: `${getVendorDisplayName(v) || v} / ${m}`,
          }
        })
      this.setState(
        {
          vendorOptions,
          modelOptions,
          selectedVendor: vendorOptions[0]?.value || '',
          selectedModel: '',
        },
        () => {
          if (this.state.selectedVendor) this.fetchMetrics()
        }
      )
    } catch (e) {
      this.setState({ vendorOptions: [], modelOptions: [] })
    }
  }

  getStartEndStep = (query = {}) => {
    let start
    let end
    let step
    const parsedStart = Number(query.start)
    const parsedEnd = Number(query.end)
    if (
      Number.isFinite(parsedStart) &&
      Number.isFinite(parsedEnd) &&
      parsedStart > 0 &&
      parsedEnd > parsedStart
    ) {
      start = Math.floor(parsedStart)
      end = Math.floor(parsedEnd)
      step = query.step || '2m'
    } else {
      const times = query.times ?? 50
      const stepStr = query.step || '2m'
      end = Math.floor(Date.now() / 1000)
      const stepMinutes = parseFloat(stepStr) || 2
      const stepSec = stepStr.endsWith('h')
        ? stepMinutes * 3600
        : stepStr.endsWith('d')
        ? stepMinutes * 86400
        : stepStr.endsWith('s')
        ? stepMinutes
        : stepMinutes * 60
      start = end - Math.round(stepSec * times)
      step = stepStr
    }
    return { start, end, step: getAdaptedStep(start, end, step) }
  }

  fetchMetrics = async query => {
    const { selectedVendor, selectedModel } = this.state
    if (!selectedVendor) return
    const { start, end, step } = this.getStartEndStep(query)
    this.setState({ loading: true })
    try {
      const params = new URLSearchParams({
        vendor: selectedVendor,
        start: String(start),
        end: String(end),
        step,
      })
      if (selectedModel) {
        const [, model] = selectedModel.split('|')
        params.set('model', model)
      }
      const result = await request.get(
        `${this.apiPath}/gpus/metrics?${params.toString()}`
      )
      const results = get(result, 'results', []) || []
      const metrics = {}
      results.forEach(m => {
        metrics[m.metric_name] = m
      })
      this.setState({ metrics, loading: false })
    } catch (e) {
      this.setState({ metrics: {}, loading: false })
    }
  }

  getMonitoringCfgs = () => {
    const { metrics } = this.state
    return [
      {
        type: 'utilisation',
        title: 'GPU_MEMORY_USAGE',
        unit: '%',
        legend: ['USAGE'],
        data: get(metrics, 'node_gpu_memory_utilisation.data.result'),
      },
      {
        type: 'utilisation',
        title: 'GPU_USAGE',
        unit: '%',
        legend: ['USAGE'],
        data: get(metrics, 'node_gpu_utilisation.data.result'),
      },
      {
        type: 'usage',
        title: 'GPU_ALLOCATION_COUNT',
        unitType: 'gpu',
        legend: ['GPU_ALLOCATION_COUNT'],
        data: get(metrics, 'node_gpu_allocated.data.result'),
      },
    ]
  }

  render() {
    const {
      vendorOptions,
      modelOptions,
      selectedVendor,
      selectedModel,
      loading,
    } = this.state
    const configs = this.getMonitoringCfgs()

    return (
      <div>
        <div
          style={{
            marginBottom: 16,
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <Select
            value={selectedVendor}
            onChange={val =>
              this.setState(
                { selectedVendor: val, selectedModel: '' },
                this.fetchMetrics
              )
            }
            options={vendorOptions}
            placeholder={t('SELECT_VENDOR')}
            style={{ minWidth: 160 }}
          />
          <Select
            value={selectedModel}
            onChange={val =>
              this.setState({ selectedModel: val }, this.fetchMetrics)
            }
            options={[
              { value: '', label: t('ALL_MODELS') },
              ...modelOptions.filter(m =>
                m.value.startsWith(`${selectedVendor}|`)
              ),
            ]}
            placeholder={t('SELECT_MODEL')}
            style={{ minWidth: 200 }}
          />
        </div>
        <MonitoringController
          title={t('PHYSICAL_RESOURCES_MONITORING')}
          step="2m"
          times={50}
          onFetch={this.fetchMetrics}
          loading={loading}
          isEmpty={false}
        >
          <Loading spinning={loading}>
            <div>
              {configs.map(item => {
                const config = getAreaChartOps({
                  ...item,
                  data: item.data || [],
                })
                if (isEmpty(config.data)) return null
                return (
                  <div key={item.title} style={{ marginBottom: 16 }}>
                    <SimpleArea width="100%" height={190} {...config} />
                  </div>
                )
              })}
            </div>
          </Loading>
        </MonitoringController>
      </div>
    )
  }
}

export default GPUPhysicalMonitoring
