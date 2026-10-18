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
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with KubeSphere Console.  If not, see <https://www.gnu.org/licenses/>.
 */

import React from 'react'
import { observer, inject } from 'mobx-react'
import { get, isEmpty } from 'lodash'

import { Loading } from '@kube-design/components'
import { Card } from 'components/Base'
import { Controller as MonitoringController } from 'components/Cards/Monitoring'
import { MediumArea } from 'components/Charts'
import { getAreaChartOps } from 'utils/monitoring'

import { PerformanceMetrics } from 'stores/juicefs'

import * as styles from './index.scss'

/**
 * Performance tab.
 *
 * These charts are the half that explains a slow model load: a full cache serves
 * reads from local disk, a cache that keeps missing goes to the object store, and
 * the object store is the slow path. They come from the JuiceFS client inside the
 * mount pod, so they are per node.
 *
 * When the client metrics are off the tab says so instead of drawing empty charts:
 * that is a configuration state (metrics option missing from the driver config),
 * not a quiet cluster.
 */
@inject('rootStore')
@observer
export default class SharedPerformance extends React.Component {
  get store() {
    return this.props.rootStore.juicefs
  }

  get metrics() {
    return this.store.data
  }

  componentDidMount() {
    this.store.fetchPerformance()
  }

  fetchMetrics = params => {
    this.store.fetchPerformance({ ...params, cluster: this.store.cluster })
  }

  isEmptyData = () => {
    const { data } = this.store
    if (isEmpty(data)) return true
    return Object.values(data).every(item =>
      isEmpty(get(item, 'data.result'))
    )
  }

  get charts() {
    return [
      {
        title: 'SHARED_STORAGE_READ_THROUGHPUT',
        metric: PerformanceMetrics.readBytes,
        unitType: 'bandwidth',
      },
      {
        title: 'SHARED_STORAGE_WRITE_THROUGHPUT',
        metric: PerformanceMetrics.writtenBytes,
        unitType: 'bandwidth',
      },
      {
        title: 'SHARED_STORAGE_CACHE_HIT_RATIO',
        metric: PerformanceMetrics.cacheHitRatio,
        unit: '%',
        legend: ['SHARED_STORAGE_CACHE'],
      },
      {
        title: 'SHARED_STORAGE_CACHE_READ_LATENCY',
        metric: PerformanceMetrics.cacheReadLatency,
        unitType: 'time',
      },
      {
        title: 'SHARED_STORAGE_FUSE_LATENCY',
        metric: PerformanceMetrics.fuseLatency,
        unitType: 'time',
      },
      {
        title: 'SHARED_STORAGE_OBJECT_ERRORS',
        metric: PerformanceMetrics.objectErrors,
        unit: t('SHARED_STORAGE_PER_SECOND'),
      },
    ]
  }

  renderChart = chart => {
    const data = get(this.metrics, `${chart.metric}.data.result`, [])
    const config = getAreaChartOps({
      type: 'line',
      title: t(chart.title),
      unitType: chart.unitType,
      unit: chart.unit,
      legend: chart.legend || [],
      data,
    })

    return (
      <div key={chart.metric} className={styles.item}>
        <MediumArea width="100%" height={120} {...config} />
      </div>
    )
  }

  renderMetricsOff() {
    return (
      <Card title={t('SHARED_STORAGE_PERFORMANCE')}>
        <div className={styles.empty}>
          {t('SHARED_STORAGE_METRICS_OFF_HINT')}
        </div>
      </Card>
    )
  }

  render() {
    const { volumes } = this.store
    const metricsEnabled = volumes.some(volume => volume.metricsEnabled)

    if (!metricsEnabled) {
      return this.renderMetricsOff()
    }

    return (
      <Loading spinning={this.store.isLoading}>
        <MonitoringController
          title={t('SHARED_STORAGE_PERFORMANCE')}
          step="5m"
          times={100}
          loading={this.store.isLoading}
          isEmpty={this.isEmptyData()}
          onFetch={this.fetchMetrics}
        >
          <div className={styles.charts}>{this.charts.map(this.renderChart)}</div>
        </MonitoringController>
      </Loading>
    )
  }
}
