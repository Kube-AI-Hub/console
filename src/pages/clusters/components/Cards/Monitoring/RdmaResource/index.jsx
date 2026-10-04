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
import { observer } from 'mobx-react'
import { get, isEmpty, last } from 'lodash'

import {
  getAreaChartOps,
  getSuitableUnit,
  getValueByUnit,
} from 'utils/monitoring'
import ClusterMonitorStore from 'stores/monitoring/cluster'
import RdmaStore from 'stores/rdma'

import { SimpleArea } from 'components/Charts'
import { StatusTabs } from 'components/Cards/Monitoring'

import * as styles from './index.scss'

const MetricTypes = {
  port_up: 'cluster_ib_port_up',
  port_total: 'cluster_ib_port_total',
  health: 'cluster_ib_health',
  rx_bytes: 'cluster_ib_rx_bytes',
  tx_bytes: 'cluster_ib_tx_bytes',
  rx_errors: 'cluster_ib_rx_errors',
  retrans: 'cluster_ib_retrans',
}

// StatTab mirrors the ClusterResource tab cell. `secondary` is used by the
// throughput tab to show received/transmitted side by side.
const StatTab = ({ name, used, secondary, total, unit, unitType }) => {
  let display = used
  let unitText = unit

  if (unitType === 'throughput') {
    const suitable = getSuitableUnit(secondary || used, 'throughput') || 'B/s'
    unitText = suitable
    display =
      secondary === undefined
        ? getValueByUnit(used, suitable)
        : `${getValueByUnit(secondary, suitable)} / ${getValueByUnit(
            used,
            suitable
          )}`
  }

  return (
    <div className={styles.stat}>
      <div className={styles.statTitle}>{t(name)}</div>
      <div className={styles.statValue}>
        {display}
        {total ? <span>/{total}</span> : null}
        {unitText ? <em>{unitText}</em> : null}
      </div>
    </div>
  )
}

export default
@observer
class RdmaResource extends React.Component {
  constructor(props) {
    super(props)

    this.monitorStore = new ClusterMonitorStore({ cluster: props.cluster })
    this.rdmaStore = new RdmaStore()
    this.state = { ports: [] }
  }

  componentDidMount() {
    this.fetchPorts()
  }

  get metrics() {
    return this.monitorStore.data
  }

  fetchData = (params = {}) => {
    this.monitorStore.fetchMetrics({
      metrics: Object.values(MetricTypes),
      step: '5m',
      times: 100,
      ...params,
    })
    this.fetchPorts()
  }

  fetchPorts = async () => {
    // fetchList already swallows its own errors and returns [], but guard the
    // shape anyway: the ports list must never be able to break the overview.
    const ports = await this.rdmaStore.fetchList({ limit: -1 })
    this.setState({ ports: Array.isArray(ports) ? ports : [] })
  }

  // Last sample of a series, or 0 when it is absent. The monitoring API returns a
  // matrix (data.result[0].values) for range queries and a vector
  // (data.result[0].value) for instant ones; handle both. Absence is normal on a
  // cluster without IB hardware and is not an error.
  getLastValue = metric => {
    const first = get(this.metrics, `${metric}.data.result[0]`, {})
    const values = get(first, 'values', [])
    const point = !isEmpty(values) ? last(values) : get(first, 'value', [])
    return parseFloat(get(point, '[1]', 0)) || 0
  }

  // Nodes with at least one port that is not active/up, worst first. This is the
  // "which node do I go look at" list for an operator.
  getAbnormalNodes = () => {
    const byNode = {}
    // Defensive: a failed ports fetch must not take the whole overview down.
    const ports = Array.isArray(this.state.ports) ? this.state.ports : []
    ports.forEach(port => {
      if (!port || !port.nodeName) return
      const entry = byNode[port.nodeName] || {
        nodeName: port.nodeName,
        total: 0,
        down: 0,
      }
      entry.total += 1
      if (!port.healthy) entry.down += 1
      byNode[port.nodeName] = entry
    })
    return Object.values(byNode)
      .filter(entry => entry.down > 0)
      .sort((a, b) => b.down - a.down)
  }

  getTabOptions = () => [
    {
      props: {
        name: 'RDMA_HEALTH',
        unit: '%',
        used: Math.round(this.getLastValue(MetricTypes.health) * 100),
        total: 100,
      },
      component: StatTab,
    },
    {
      props: {
        name: 'RDMA_PORT_UP',
        unit: '',
        used: this.getLastValue(MetricTypes.port_up),
        total: this.getLastValue(MetricTypes.port_total),
      },
      component: StatTab,
    },
    {
      props: {
        name: 'RDMA_THROUGHPUT',
        unitType: 'throughput',
        used: this.getLastValue(MetricTypes.rx_bytes),
        secondary: this.getLastValue(MetricTypes.tx_bytes),
      },
      component: StatTab,
    },
    {
      props: {
        name: 'RDMA_ERRORS',
        unit: '',
        used: this.getLastValue(MetricTypes.rx_errors),
      },
      component: StatTab,
    },
  ]

  getContentOptions = () => {
    // One chart per tab, in the same order as getTabOptions.
    //
    // `data` takes one entry per legend item and each entry must be a single
    // series result (with a `values` array) -- the same shape every other
    // monitoring card uses. These cluster_ib_* metrics are already aggregated to
    // one series, so result[0] is the whole series.
    const point = metric => get(this.metrics, `${metric}.data.result[0]`, {})

    const charts = [
      {
        type: 'utilisation',
        title: 'RDMA_HEALTH',
        unit: '%',
        legend: ['RDMA_HEALTH'],
        data: [point(MetricTypes.health)],
      },
      {
        type: 'utilisation',
        title: 'RDMA_PORT_STATUS',
        unit: '',
        legend: ['RDMA_PORT_UP', 'RDMA_PORT_TOTAL'],
        data: [point(MetricTypes.port_up), point(MetricTypes.port_total)],
      },
      {
        type: 'throughput',
        title: 'RDMA_THROUGHPUT',
        unitType: 'throughput',
        legend: ['RDMA_OUT', 'RDMA_IN'],
        data: [point(MetricTypes.tx_bytes), point(MetricTypes.rx_bytes)],
      },
      {
        type: 'utilisation',
        title: 'RDMA_ERRORS',
        unit: '',
        legend: ['RDMA_RX_ERRORS', 'RDMA_RETRANS'],
        data: [point(MetricTypes.rx_errors), point(MetricTypes.retrans)],
      },
    ]

    return charts.map(item => ({
      props: { option: item },
      render: ({ option }) => (
        <div className={styles.content}>
          {this.renderAbnormalNodes()}
          {this.renderChart(option)}
        </div>
      ),
    }))
  }

  renderChart(option) {
    const config = getAreaChartOps(option)
    if (!config.data || config.data.length === 0) {
      // Every series is empty: either the metric is not collected on this
      // cluster or the selected range has no samples yet.
      return <div className={styles.abnormalEmpty}>{t('NO_DATA')}</div>
    }
    return <SimpleArea key={option.title} width="100%" {...config} />
  }

  renderAbnormalNodes() {
    const abnormal = this.getAbnormalNodes()
    if (abnormal.length === 0) {
      return (
        <div className={styles.abnormalEmpty}>
          {t('RDMA_NO_ABNORMAL_NODES')}
        </div>
      )
    }
    return (
      <div className={styles.abnormal}>
        <div className={styles.abnormalTitle}>{t('RDMA_ABNORMAL_NODES')}</div>
        <ul className={styles.abnormalList}>
          {abnormal.map(item => (
            <li key={item.nodeName}>
              <span className={styles.abnormalNode}>{item.nodeName}</span>
              <span className={styles.abnormalCount}>
                {t('RDMA_ABNORMAL_PORTS', {
                  down: item.down,
                  total: item.total,
                })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  render() {
    const { isLoading, isRefreshing } = this.monitorStore

    return (
      <StatusTabs
        title={t('RDMA_STATUS')}
        tabOptions={this.getTabOptions()}
        contentOptions={this.getContentOptions()}
        loading={isLoading}
        refreshing={isRefreshing}
        onFetch={this.fetchData}
      />
    )
  }
}
