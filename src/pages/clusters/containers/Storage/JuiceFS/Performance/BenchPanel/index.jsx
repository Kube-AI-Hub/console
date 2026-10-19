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
import { get } from 'lodash'
import PropTypes from 'prop-types'

import { Alert, Button } from '@kube-design/components'
import { Card } from 'components/Base'

import * as styles from './index.scss'

const FILE_SIZES = [128, 256, 512]
const THREADS = [1, 2, 4]

// Poll cadence. A 256 MiB run takes a few seconds on a healthy volume, so 3s is
// responsive without turning the poll into a load of its own.
const POLL_INTERVAL = 3000

/**
 * On-demand throughput benchmark.
 *
 * The charts on this tab are passive: they show what traffic happened, which is
 * nothing when nobody is loading a model. This panel makes the measurement
 * deliberate - write a file, read it back, report MiB/s - so an operator can tell
 * "the storage is slow" from "the storage is idle".
 *
 * The run happens in a job on the cluster, not in the browser, and not in the
 * mount pod (whose view of the filesystem is read-only). The API returns a job
 * name; this component polls until it finishes.
 */
@inject('rootStore')
@observer
export default class BenchPanel extends React.Component {
  static propTypes = {
    // Called once a run succeeds, so the page can widen its window and refetch.
    onFinished: PropTypes.func,
  }

  static defaultProps = {
    onFinished: null,
  }

  state = {
    volume: '',
    fileSizeMiB: 256,
    threads: 1,
    run: null,
    starting: false,
    error: '',
    elapsed: 0,
  }

  pollTimer = null
  tickTimer = null

  get store() {
    return this.props.rootStore.juicefs
  }

  componentDidMount() {
    this.store.fetchVolumes().then(() => this.restoreLastRun())
  }

  componentWillUnmount() {
    this.stopTimers()
  }

  /** Bring back the last run so a page reload does not lose the numbers. */
  restoreLastRun = async () => {
    try {
      const result = await this.store.fetchBenches()
      const latest = get(result, 'items[0]')
      if (!latest) return
      this.setState({ run: latest, volume: latest.volume || this.state.volume })
      if (latest.phase === 'Pending' || latest.phase === 'Running') {
        this.startPolling(latest)
      }
    } catch (error) {
      // A missing history is not worth an alert: the panel still works.
    }
  }

  get volumes() {
    return (this.store.volumes || []).filter(volume => volume.capacityBytes > 0)
  }

  get selectedVolume() {
    const { volume } = this.state
    const found = this.volumes.find(item => item.name === volume)
    return found || this.volumes[0]
  }

  get running() {
    const { run } = this.state
    return !!run && (run.phase === 'Pending' || run.phase === 'Running')
  }

  handleVolumeChange = event => this.setState({ volume: event.target.value })

  handleSizeChange = event =>
    this.setState({ fileSizeMiB: Number(event.target.value) })

  handleThreadsChange = event =>
    this.setState({ threads: Number(event.target.value) })

  startPolling = run => {
    this.stopTimers()
    this.setState({ elapsed: 0 })
    this.tickTimer = setInterval(
      () => this.setState(state => ({ elapsed: state.elapsed + 1 })),
      1000
    )
    this.pollTimer = setInterval(() => this.poll(run), POLL_INTERVAL)
  }

  stopTimers = () => {
    if (this.pollTimer) clearInterval(this.pollTimer)
    if (this.tickTimer) clearInterval(this.tickTimer)
    this.pollTimer = null
    this.tickTimer = null
  }

  poll = async run => {
    try {
      const latest = await this.store.fetchBench(run.name, run.claimNamespace)
      this.setState({ run: latest })
      if (latest.phase === 'Succeeded' || latest.phase === 'Failed') {
        this.stopTimers()
        if (latest.phase === 'Succeeded') {
          // The benchmark just moved real bytes, so the charts have something to
          // show; the parent narrows the window and refetches.
          if (this.props.onFinished) this.props.onFinished(latest)
        }
      }
    } catch (error) {
      this.stopTimers()
      this.setState({ error: get(error, 'message', '') })
    }
  }

  handleStart = async () => {
    const volume = this.selectedVolume
    if (!volume) return

    this.setState({ starting: true, error: '', run: null })
    try {
      const run = await this.store.startBench(volume.name, {
        fileSizeMiB: this.state.fileSizeMiB,
        threads: this.state.threads,
      })
      this.setState({ starting: false, run })
      this.startPolling(run)
    } catch (error) {
      this.setState({
        starting: false,
        error: get(error, 'message', '') || t('SHARED_STORAGE_BENCH_FAILED'),
      })
    }
  }

  renderResult(run) {
    const result = run.result || {}
    const measured = result.writeMeasured || result.readMeasured
    if (!measured) return null

    return (
      <div className={styles.results}>
        <div className={styles.result}>
          <span className={styles.resultLabel}>
            {t('SHARED_STORAGE_BENCH_WRITE')}
          </span>
          <span className={styles.resultValue} data-bench="write">
            {result.writeMiBps.toFixed(1)} MiB/s
          </span>
          <span className={styles.resultCost}>
            {result.writeSeconds.toFixed(2)} s/file
          </span>
        </div>
        <div className={styles.result}>
          <span className={styles.resultLabel}>
            {t('SHARED_STORAGE_BENCH_READ')}
          </span>
          <span className={styles.resultValue} data-bench="read">
            {result.readMiBps.toFixed(1)} MiB/s
          </span>
          <span className={styles.resultCost}>
            {result.readSeconds.toFixed(2)} s/file
          </span>
        </div>
      </div>
    )
  }

  render() {
    const { fileSizeMiB, threads, run, starting, error, elapsed } = this.state
    const volume = this.selectedVolume

    if (!this.volumes.length) {
      return (
        <Card title={t('SHARED_STORAGE_BENCH')}>
          <div className={styles.hint}>{t('SHARED_STORAGE_BENCH_NO_VOLUME')}</div>
        </Card>
      )
    }

    return (
      <Card title={t('SHARED_STORAGE_BENCH')}>
        <div className={styles.hint}>{t('SHARED_STORAGE_BENCH_DESC')}</div>

        <div className={styles.form}>
          <label className={styles.field}>
            <span className={styles.label}>{t('SHARED_STORAGE_BENCH_VOLUME')}</span>
            <select
              name="bench-volume"
              className={styles.select}
              value={volume ? volume.name : ''}
              onChange={this.handleVolumeChange}
              disabled={this.running || starting}
            >
              {this.volumes.map(item => (
                <option key={item.name} value={item.name}>
                  {item.path}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t('SHARED_STORAGE_BENCH_FILE_SIZE')}</span>
            <select
              name="bench-file-size"
              className={styles.select}
              value={fileSizeMiB}
              onChange={this.handleSizeChange}
              disabled={this.running || starting}
            >
              {FILE_SIZES.map(size => (
                <option key={size} value={size}>
                  {size} MiB
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t('SHARED_STORAGE_BENCH_THREADS')}</span>
            <select
              name="bench-threads"
              className={styles.select}
              value={threads}
              onChange={this.handleThreadsChange}
              disabled={this.running || starting}
            >
              {THREADS.map(count => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>

          <Button
            type="control"
            onClick={this.handleStart}
            disabled={this.running || starting || !volume}
            loading={starting}
          >
            {this.running
              ? t('SHARED_STORAGE_BENCH_RUNNING', { seconds: elapsed })
              : t('SHARED_STORAGE_BENCH_START')}
          </Button>
        </div>

        {this.running ? (
          <div className={styles.status}>
            <span className={styles.statusText}>
              {t('SHARED_STORAGE_BENCH_RUNNING_HINT')}
            </span>
          </div>
        ) : null}

        {run && run.phase === 'Succeeded' ? this.renderResult(run) : null}

        {run && run.phase === 'Failed' ? (
          <div>
            <Alert type="error" message={t('SHARED_STORAGE_BENCH_FAILED')} />
            {run.logTail ? (
              <pre className={styles.log} data-bench="log">
                {run.logTail}
              </pre>
            ) : null}
          </div>
        ) : null}

        {error ? <Alert type="error" message={error} /> : null}

        {run && run.phase === 'Succeeded' ? (
          <div className={styles.hint}>
            {t('SHARED_STORAGE_BENCH_WARM_CACHE', {
              size: run.result.fileSizeMiB,
              threads: run.result.threads,
            })}
          </div>
        ) : null}
      </Card>
    )
  }
}
