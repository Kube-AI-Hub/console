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
import { getAreaChartOps, getValueByUnit } from 'utils/monitoring'

import { PerformanceMetrics } from 'stores/juicefs'

import { formatBytes } from '../utils'
import BenchPanel from './BenchPanel'

// `formatBytes` drops the unit at zero ("0"), which reads as a count next to
// "区间合计". The range total is a byte quantity even when it is zero.
const formatTotal = total => (total > 0 ? formatBytes(total) : '0 B')

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
  state = {
    // A benchmark moves bytes for a few seconds. Averaged into a 5m step over an
    // 8h window that burst is nearly invisible, and an operator who just ran a
    // test sees the chart still saying "no traffic". After a run the page narrows
    // the window to 30 minutes at a 1m step so the run is actually visible.
    benchWindow: false,
  }

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

  componentWillUnmount() {
    this.clearBenchRetries()
  }

  fetchMetrics = params => {
    this.store.fetchPerformance({ ...params, cluster: this.store.cluster })
  }

  /**
   * Called by the benchmark panel once a run succeeds.
   *
   * Two things change: the window narrows (a 30-minute window at a 1m step shows
   * the burst instead of averaging it away), and the charts are refetched.
   *
   * The refetch repeats because Prometheus scrapes the mount pod every 30s: a
   * single fetch right after the run reads the counter from before it started, so
   * the chart would still say "no traffic" for a run that just moved 400 MiB/s.
   * Two more attempts at 35s and 70s cover a full scrape plus the query round-trip.
   */
  handleBenchFinished = () => {
    this.setState({ benchWindow: true }, () => {
      this.fetchBenchWindow()
      this.clearBenchRetries()
      this.benchRetries = [
        setTimeout(this.fetchBenchWindow, 35_000),
        setTimeout(this.fetchBenchWindow, 70_000),
      ]
    })
  }

  fetchBenchWindow = () => {
    this.store.fetchPerformance({
      cluster: this.store.cluster,
      step: '1m',
      times: 30,
    })
  }

  clearBenchRetries = () => {
    (this.benchRetries || []).forEach(timer => clearTimeout(timer))
    this.benchRetries = []
  }

  isEmptyData = () => {
    const { data } = this.store
    if (isEmpty(data)) return true
    return Object.values(data).every(item =>
      isEmpty(get(item, 'data.result'))
    )
  }

  /** True when the throughput series carry no nonzero point. */
  throughputIsZero = () => {
    const { data } = this.store
    return [PerformanceMetrics.readBytes, PerformanceMetrics.writtenBytes].every(
      metric => {
        const series = get(data, `${metric}.data.result`, [])
        return (
          !isArray(series) ||
          series.every(item =>
            (item.values || []).every(point => Number(get(point, [1], 0)) === 0)
          )
        )
      }
    )
  }

  /**
   * A successful benchmark that leaves the charts flat means the bytes did not go
   * through the client Prometheus scrapes.
   *
   * The scrape target is the per-class mount pod, whose own mount is read-only
   * (`ro` in its client options). A write from a pod goes through the separate
   * client the CSI driver starts for that claim, and that one does not expose
   * `metrics=`, so its counters never reach Prometheus. Saying this beats leaving
   * the operator with "no traffic" right after a 300 MiB/s write.
   */
  get benchWithoutMetrics() {
    return this.state.benchWindow && this.throughputIsZero()
  }

  get charts() {
    // Every chart needs a legend with one entry per series key. `getChartData`
    // writes each point under `legend[index]`, so an empty legend silently drops
    // every value: the curve disappears and the title falls back to a dash, while
    // the range total (computed from the raw series) still shows a number.
    return [
      {
        title: 'SHARED_STORAGE_READ_THROUGHPUT',
        metric: PerformanceMetrics.readBytes,
        unitType: 'throughput',
        legend: [t('SHARED_STORAGE_READ_THROUGHPUT')],
        // A rate over the selected window; the title adds the range total.
        summable: true,
        emptyKey: 'SHARED_STORAGE_NO_TRAFFIC',
      },
      {
        title: 'SHARED_STORAGE_WRITE_THROUGHPUT',
        metric: PerformanceMetrics.writtenBytes,
        unitType: 'throughput',
        legend: [t('SHARED_STORAGE_WRITE_THROUGHPUT')],
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
        legend: [t('SHARED_STORAGE_CACHE_READ_LATENCY')],
      },
      {
        title: 'SHARED_STORAGE_FUSE_LATENCY',
        metric: PerformanceMetrics.fuseLatency,
        unitType: 'second',
        legend: [t('SHARED_STORAGE_FUSE_LATENCY')],
      },
      {
        title: 'SHARED_STORAGE_OBJECT_ERRORS',
        metric: PerformanceMetrics.objectErrors,
        unit: t('SHARED_STORAGE_PER_SECOND'),
        legend: [t('SHARED_STORAGE_OBJECT_ERRORS')],
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

  /**
   * The last painted value of a chart, in the chart's own unit.
   *
   * `getAreaChartOps` converts the series through `getValueByUnit`, so reading the
   * converted point keeps the title consistent with the curve.
   *
   * `last` is not enough: `rate(...[5m])` returns null for the newest points until
   * a full window has been scraped, so the last entry of a series that is clearly
   * drawing a curve can still be null. Walk back to the most recent non-null point
   * instead of showing a dash next to a visible line.
   */
  lastValue = points => {
    if (!isArray(points) || !points.length) return null
    const key = Object.keys(points[0]).find(item => item !== 'time')
    if (!key) return null
    for (let i = points.length - 1; i >= 0; i -= 1) {
      const value = get(points[i], key)
      if (value !== null && value !== undefined) return value
    }
    return null
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

    // MediumArea's default title prints the last value and then `${title}_PL`
    // whenever `unit` is empty, so it cannot be used as-is. Render the same
    // information here (value + unit + name) and add the range total underneath.
    const current = this.lastValue(config.data)
    const unit = config.unit || ''
    config.renderTitle = () => (
      <div className={styles.chartTitle}>
        <span className={styles.chartValue}>
          {current === null ? '-' : current}
          {unit ? ` ${unit}` : ''}
        </span>
        <span className={styles.chartName}>{t(chart.title)}</span>
        {chart.summable ? (
          <span className={styles.chartTotal}>
            {t('SHARED_STORAGE_RANGE_TOTAL')} {formatTotal(total)}
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
            <span className={styles.chartTotal}>
              {t('SHARED_STORAGE_RANGE_TOTAL')} {formatTotal(total)}
            </span>
          </div>
        ) : (
          <MediumArea width="100%" height={120} {...config} />
        )}
      </div>
    )
  }

  renderMetricsOff() {
    return (
      <div>
        {/* The benchmark does not need client metrics: it measures by doing IO, so
            keep it available even when the charts have nothing to draw. */}
        <BenchPanel />
        <Card title={t('SHARED_STORAGE_PERFORMANCE')}>
          <div className={styles.empty}>
            {t('SHARED_STORAGE_METRICS_OFF_HINT')}
          </div>
        </Card>
      </div>
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
        <BenchPanel onFinished={this.handleBenchFinished} />
        {this.benchWithoutMetrics ? (
          <div className={styles.benchHint} data-bench-hint="no-metrics">
            {t('SHARED_STORAGE_BENCH_NO_METRICS')}
          </div>
        ) : null}
        <MonitoringController
          title={t('SHARED_STORAGE_PERFORMANCE')}
          step={this.state.benchWindow ? '1m' : '5m'}
          times={this.state.benchWindow ? 30 : 100}
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
