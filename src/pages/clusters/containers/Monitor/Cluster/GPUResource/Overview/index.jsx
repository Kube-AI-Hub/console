/*
 * Copyright (C) 2026 Kube AI Hub.
 *
 * KubeSphere Console is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
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
import { observer, inject } from 'mobx-react'
import { get, isEmpty } from 'lodash'

import { Columns, Column, Loading } from '@kube-design/components'
import { Card } from 'components/Base'
import {
  StatusCircle,
  Controller as MonitoringController,
} from 'components/Cards/Monitoring'
import ClusterMonitorStore from 'stores/monitoring/cluster'
import {
  getAreaChartOps,
  getZeroValues,
  getLastMonitoringData,
  getSuitableUnit,
  getValueByUnit,
} from 'utils/monitoring'
import { MediumArea } from 'components/Charts'
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Sector,
  ResponsiveContainer,
} from 'recharts'
import { getVendorDisplayName } from 'utils'
import { renderGpuVendorIcon } from 'utils/gpuVendors'
import variables from '~scss/variables.module.scss'

import GPUModelUsageTable from './ModelUsageTable'

import * as styles from './index.scss'

const PIE_COLORS = [
  variables.greenColor01,
  variables.greenColor02,
  variables.greenColor03,
  variables.greenColor04,
  variables.blueColor01,
  variables.blueColor02,
  variables.blueColor03,
  variables.blueColor04,
  variables.blueColor05,
]

const renderActiveShape = props => {
  const RADIAN = Math.PI / 180
  const {
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    percent,
    value,
  } = props
  const sin = Math.sin(-RADIAN * midAngle)
  const cos = Math.cos(-RADIAN * midAngle)
  const sx = cx + (outerRadius + 10) * cos
  const sy = cy + (outerRadius + 10) * sin
  const mx = cx + (outerRadius + 30) * cos
  const my = cy + (outerRadius + 30) * sin
  const ex = mx + (cos >= 0 ? 1 : -1) * 22
  const ey = my
  const textAnchor = cos >= 0 ? 'start' : 'end'

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill}>
        {payload.displayName}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 6}
        outerRadius={outerRadius + 10}
        fill={fill}
      />
      <path
        d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
        stroke={fill}
        fill="none"
      />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 12}
        y={ey}
        textAnchor={textAnchor}
        fill={variables.darkColor06}
      >
        {`${value} ${t('GPU_CARD_UNIT')}`}
      </text>
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 12}
        y={ey}
        dy={18}
        textAnchor={textAnchor}
        fill={variables.darkColor01}
      >
        {`(${(percent * 100).toFixed(1)}%)`}
      </text>
    </g>
  )
}

const MetricTypes = {
  gpu_memory_utilisation: 'cluster_gpu_memory_utilisation',
  gpu_memory_usage: 'cluster_gpu_memory_usage',
  gpu_memory_total: 'cluster_gpu_memory_total',
  gpu_utilization: 'cluster_gpu_utilization',
  gpu_usage: 'cluster_gpu_usage',
  gpu_total: 'cluster_gpu_total',
  gpu_allocated: 'cluster_gpu_allocated',
}

@inject('rootStore')
@observer
class GPUResourceOverview extends React.Component {
  constructor(props) {
    super(props)
    this.monitorStore = new ClusterMonitorStore({ cluster: this.cluster })
    this.state = {
      stats: {},
      modelUsage: [],
      statsLoading: true,
      modelUsageLoading: true,
      activePieIndex: 0,
    }
  }

  get cluster() {
    return this.props.cluster || get(this.props, 'match.params.cluster')
  }

  get metrics() {
    return this.monitorStore.data
  }

  componentDidMount() {
    this.fetchStats()
    this.fetchModelUsage()
    this.fetchMetrics()
  }

  getGpuApiPath = () =>
    globals.app.isMultiCluster
      ? `/kapis/clusters/${this.cluster}/gpu.kubesphere.io/v1alpha1`
      : '/kapis/gpu.kubesphere.io/v1alpha1'

  fetchStats = async () => {
    this.setState({ statsLoading: true })
    try {
      const result = await request.get(`${this.getGpuApiPath()}/gpus/stats`)
      this.setState({
        stats: typeof result === 'object' && result !== null ? result : {},
        statsLoading: false,
      })
    } catch {
      this.setState({ stats: {}, statsLoading: false })
    }
  }

  fetchModelUsage = async () => {
    this.setState({ modelUsageLoading: true })
    try {
      const result = await request.get(
        `${this.getGpuApiPath()}/gpus/model-usage`
      )
      this.setState({
        modelUsage: Array.isArray(result) ? result : [],
        modelUsageLoading: false,
      })
    } catch {
      this.setState({ modelUsage: [], modelUsageLoading: false })
    }
  }

  fetchMetrics = (params = {}) => {
    this.monitorStore.fetchMetrics({
      metrics: Object.values(MetricTypes),
      step: '5m',
      times: 100,
      ...params,
    })
  }

  isEmptyData = data => {
    if (isEmpty(data)) return true
    return Object.values(data).every(item => isEmpty(get(item, 'data.result')))
  }

  getMonitoringCfgs = () => [
    {
      type: 'utilisation',
      title: 'GPU_MEMORY_USAGE',
      unit: '%',
      legend: ['USAGE'],
      metricType: MetricTypes.gpu_memory_utilisation,
    },
    {
      type: 'utilisation',
      title: 'GPU_USAGE',
      unit: '%',
      legend: ['USAGE'],
      metricType: MetricTypes.gpu_utilization,
    },
    {
      type: 'usage',
      title: 'GPU_ALLOCATION_COUNT',
      unitType: 'gpu',
      legend: ['GPU_ALLOCATION_COUNT'],
      metricType: MetricTypes.gpu_allocated,
    },
  ]

  renderGPUStatus() {
    const { stats, statsLoading } = this.state
    const total = Number(stats.total) || 0
    const healthy = Number(stats.healthy) || 0

    return (
      <Card className={styles.node} title={t('CLUSTER_GPU_STATUS')}>
        <Loading spinning={statsLoading}>
          <StatusCircle
            theme="light"
            className={styles.nodeStatus}
            name={t('GPU_ONLINE_STATUS')}
            legend={['HEALTHY_GPUS', 'ALL_GPUS']}
            used={healthy}
            total={total}
          />
        </Loading>
      </Card>
    )
  }

  onPieEnter = (_, index) => {
    this.setState({ activePieIndex: index })
  }

  renderVendorPie() {
    const { stats, statsLoading, activePieIndex } = this.state
    const vendorCounts = {}
    Object.keys(stats).forEach(key => {
      if (key === 'total' || key === 'healthy') return
      const vendor = key.split('-')[0] || 'unknown'
      vendorCounts[vendor] =
        (vendorCounts[vendor] || 0) + Number(stats[key] || 0)
    })
    const total = Object.values(vendorCounts).reduce((a, b) => a + b, 0)
    const data = Object.entries(vendorCounts).map(([vendor, count], i) => ({
      name: vendor,
      displayName: getVendorDisplayName(vendor),
      value: count,
      percent: total > 0 ? (count / total).toFixed(2) : '0',
      color: PIE_COLORS[i % PIE_COLORS.length],
    }))
    return (
      <Card className={styles.pie} title={t('GPU_VENDOR_DISTRIBUTION')}>
        <Loading spinning={statsLoading}>
          {total === 0 ? (
            <div className={styles.piePlaceholder}>{t('NO_DATA')}</div>
          ) : (
            <div className={styles.pieWrapper}>
              <div className={styles.vendorList}>
                {data.map(item => (
                  <div key={item.name} className={styles.vendorItem}>
                    <i
                      className={styles.vendorDot}
                      style={{ backgroundColor: item.color }}
                    />
                    {renderGpuVendorIcon(item.name, 24)}
                    <span className={styles.vendorName}>
                      {item.displayName}
                    </span>
                    <span className={styles.vendorCount}>
                      {item.value} {t('GPU_CARD_UNIT')} ({item.percent}%)
                    </span>
                  </div>
                ))}
              </div>
              <div className={styles.pieChart}>
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      cx="50%"
                      data={data}
                      dataKey="value"
                      innerRadius="60%"
                      outerRadius="75%"
                      activeIndex={activePieIndex}
                      activeShape={renderActiveShape}
                      onMouseEnter={this.onPieEnter}
                    >
                      {data.map(entry => (
                        <Cell
                          key={`cell-${entry.name}`}
                          fill={entry.color}
                          strokeWidth={1}
                        />
                      ))}
                    </Pie>
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </Loading>
      </Card>
    )
  }

  renderResourceUsage() {
    const configs = this.getMonitoringCfgs()
    const { isLoading, isRefreshing } = this.monitorStore

    return (
      <MonitoringController
        title={t('CLUSTER_RESOURCE_USAGE')}
        step="5m"
        times={100}
        onFetch={this.fetchMetrics}
        loading={isLoading}
        refreshing={isRefreshing}
        isEmpty={this.isEmptyData(this.metrics)}
      >
        <div className={styles.content}>
          {configs.map(item => {
            const itemData =
              get(this.metrics, `${item.metricType}.data.result`) || []
            const config = getAreaChartOps({
              ...item,
              data: isEmpty(itemData)
                ? [{ values: getZeroValues() }]
                : itemData,
            })
            if (item.metricType === MetricTypes.gpu_memory_utilisation) {
              const lastData = getLastMonitoringData(this.metrics)
              const used = get(
                lastData,
                '[cluster_gpu_memory_usage].value[1]',
                0
              )
              const total = get(
                lastData,
                '[cluster_gpu_memory_total].value[1]',
                0
              )
              const unit = getSuitableUnit(total || used, 'gpu_memory') || 'Mi'
              const usedStr = getValueByUnit(used, unit)
              const totalStr = getValueByUnit(total, unit)
              const util = total > 0 ? ((used / total) * 100).toFixed(2) : '0'
              config.renderTitle = () => (
                <div className={styles.chartTitle}>
                  <span>
                    <strong>{util}%</strong> {usedStr}/{totalStr} {t(unit)}
                  </span>
                  {t(item.title)}
                </div>
              )
            } else if (item.metricType === MetricTypes.gpu_utilization) {
              const lastData = getLastMonitoringData(this.metrics)
              const used = Number(
                get(lastData, '[cluster_gpu_usage].value[1]', 0)
              )
              const total = Number(
                get(lastData, '[cluster_gpu_total].value[1]', 0)
              )
              const util = total > 0 ? ((used / total) * 100).toFixed(2) : '0'
              config.renderTitle = () => (
                <div className={styles.chartTitle}>
                  <span>
                    <strong>{util}%</strong> {used.toFixed(2)}/
                    {total.toFixed(2)} {t('GPU_CARD_UNIT')}
                  </span>
                  {t(item.title)}
                </div>
              )
            } else if (item.metricType === MetricTypes.gpu_allocated) {
              const lastData = getLastMonitoringData(this.metrics)
              const allocated = Number(
                get(lastData, '[cluster_gpu_allocated].value[1]', 0)
              )
              const total = Number(
                get(lastData, '[cluster_gpu_total].value[1]', 0)
              )
              const util =
                total > 0 ? ((allocated / total) * 100).toFixed(2) : '0'
              config.renderTitle = () => (
                <div className={styles.chartTitle}>
                  <span>
                    <strong>{util}%</strong> {allocated.toFixed(2)}/
                    {total.toFixed(2)} {t('GPU_CARD_UNIT')}
                  </span>
                  {t(item.title)}
                </div>
              )
            }
            return (
              <div key={item.title} className={styles.item}>
                <MediumArea width="100%" height={100} {...config} />
              </div>
            )
          })}
        </div>
      </MonitoringController>
    )
  }

  render() {
    return (
      <div>
        <Columns className="is-1_1">
          <Column className="is-5">{this.renderGPUStatus()}</Column>
          <Column className="is-7">{this.renderVendorPie()}</Column>
        </Columns>
        <div className={styles.section}>{this.renderResourceUsage()}</div>
        <div className={styles.section}>
          <Card title={t('GPU_MODEL_USAGE')}>
            <Loading spinning={this.state.modelUsageLoading}>
              <GPUModelUsageTable data={this.state.modelUsage} />
            </Loading>
          </Card>
        </div>
      </div>
    )
  }
}

export default GPUResourceOverview
