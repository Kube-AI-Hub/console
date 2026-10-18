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
import { get, isEmpty, isArray } from 'lodash'

import { Loading } from '@kube-design/components'
import { Card } from 'components/Base'
import { Controller as MonitoringController } from 'components/Cards/Monitoring'
import { MediumArea } from 'components/Charts'
import { getAreaChartOps } from 'utils/monitoring'

import { PerformanceMetrics } from 'stores/juicefs'

import { formatBytes } from '../utils'

import * as styles from './index.scss'

/**
 * Performance tab.
 *
 * These charts are the half that explains a slow model load: a full cache serves
 * reads from local disk, a cache that keeps missing goes to the object store, and
 * the object store is the slow path. They come from the JuiceFS client inside the
 * mount pod, so they are per node.
 *
 * Two unit facts, both learned the hard way:
 *   - the client reports **bytes**, so throughput is `throughput` (B/s). The
 *     `bandwidth` type converts to bits and showed MiB/s as Mbps, 8x off.
 *   - latency must use `second`; an unregistered unitType makes the chart fall
 *     back to `t(\`${title}_PL\`)` and the page shows `缓存读延迟_PL`.
 *
 * Idle is not broken: the series is an instantaneous rate, so a quiet 8h window
 * is a flat zero line even though gigabytes were read earlier. The title carries
 * the range total and an all-zero series gets an explicit empty state.
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
    // The metrics switch is a property of the cluster (it comes from the driver
    // config via the volume list), so that has to be loaded here too: opening the
    // performance tab directly would otherwise report "metrics off".
    this.store.fetchVolumes()
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
        unitType: 'throughput',
        // A rate over the selected window; the title adds the range total.
        summable: true,
        emptyKey: 'SHARED_STORAGE_NO_TRAFFIC',
      },
      {
        title: 'SHARED_STORAGE_WRITE_THROUGHPUT',
        metric: PerformanceMetrics.writtenBytes,
        unitType: 'throughput',
        summable: true,
        emptyKey: 'SHARED_STORAGE_NO_TRAFFIC',
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
        unitType: 'second',
      },
      {
        title: 'SHARED_STORAGE_FUSE_LATENCY',
        metric: PerformanceMetrics.fuseLatency,
        unitType: 'second',
      },
      {
        title: 'SHARED_STORAGE_OBJECT_ERRORS',
        metric: PerformanceMetrics.objectErrors,
        unit: t('SHARED_STORAGE_PER_SECOND'),
      },
    ]
  }

  /** True when every point of every series is zero (or there are none). */
  isFlatZero = metric => {
    const result = get(this.metrics, `${metric}.data.result`, [])
    if (!isArray(result) || !result.length) return true
    return result.every(series =>
      (series.values || []).every(point => Number(get(point, [1], 0)) === 0)
    )
  }

  /**
   * Bytes moved across the whole window, from the rate series.
   *
   * Each point is a bytes/second rate at a timestamp, so integrating over the
   * intervals gives the range total without a second metric: sum(rate * dt). The
   * timestamps come from the series, so this stays correct when the controller
   * changes the step for a longer window.
   */
  rangeTotal = metric => {
    const result = get(this.metrics, `${metric}.data.result`, [])
    if (!isArray(result)) return 0
    return result.reduce((total, series) => {
      const points = series.values || []
      let bytes = 0
      for (let i = 1; i < points.length; i += 1) {
        const dt = Number(get(points[i], [0], 0)) - Number(get(points[i - 1], [0], 0))
        const rate = Number(get(points[i], [1], 0))
        if (dt > 0 && rate > 0) bytes += rate * dt
      }
      return total + bytes
    }, 0)
  }

  renderChart = chart => {
    const data = get(this.metrics, `${chart.metric}.data.result`, [])
    const empty = chart.emptyKey && this.isFlatZero(chart.metric)
    const total = chart.summable ? this.rangeTotal(chart.metric) : 0

    const config = getAreaChartOps({
      type: 'line',
      title: t(chart.title),
      unitType: chart.unitType,
      unit: chart.unit,
      legend: chart.legend || [],
      data,
    })

    // The default title falls back to `${title}_PL` when `unit` is empty; always
    // give it something to show.
    config.renderTitle = () => (
      <div className={styles.chartTitle}>
        <span className={styles.chartName}>{t(chart.title)}</span>
        {total > 0 ? (
          <span className={styles.chartTotal}>
            {t('SHARED_STORAGE_RANGE_TOTAL')} {formatBytes(total)}
          </span>
        ) : null}
      </div>
    )

    return (
      <div key={chart.metric} className={styles.item}>
        {empty ? (
          <div className={styles.emptyChart}>
            <span className={styles.chartName}>{t(chart.title)}</span>
            <span className={styles.empty}>{t(chart.emptyKey)}</span>
          </div>
        ) : (
          <MediumArea width="100%" height={120} {...config} />
        )}
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
    const { volumes, volumesLoading } = this.store
    // While the list is loading, do not claim the metrics are off.
    if (volumesLoading && !volumes.length) {
      return <Loading spinning />
    }
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
