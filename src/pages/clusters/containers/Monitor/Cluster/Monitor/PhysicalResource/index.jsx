/*
 * This file is part of KubeSphere Console.
 * Copyright (C) 2019 The KubeSphere Console Authors.
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

import { getChartData, getAreaChartOps } from 'utils/monitoring'
import ClusterMonitorStore from 'stores/monitoring/cluster'

import { Controller as MonitoringController } from 'components/Cards/Monitoring'
import { SimpleArea } from 'components/Charts'
import CustomTooltip from 'components/Charts/Custom/Tooltip'

import * as styles from './index.scss'

const MetricTypes = {
  gpu_memory_utilisation: 'cluster_gpu_memory_utilisation',
  gpu_utilization: 'cluster_gpu_utilization',
  gpu_allocated: 'cluster_gpu_allocated',
  cpu_utilisation: 'cluster_cpu_utilisation',
  memory_utilisation: 'cluster_memory_utilisation',
  cpu_load1: 'cluster_load1',
  cpu_load5: 'cluster_load5',
  cpu_load15: 'cluster_load15',
  disk_size_usage: 'cluster_disk_size_usage',
  disk_inode_utilisation: 'cluster_disk_inode_utilisation',
  disk_inode_usage: 'cluster_disk_inode_usage',
  disk_inode_total: 'cluster_disk_inode_total',
  disk_read_iops: 'cluster_disk_read_iops',
  disk_write_iops: 'cluster_disk_write_iops',
  disk_read_throughput: 'cluster_disk_read_throughput',
  disk_write_throughput: 'cluster_disk_write_throughput',
  net_transmitted: 'cluster_net_bytes_transmitted',
  net_received: 'cluster_net_bytes_received',
  pod_running_count: 'cluster_pod_running_count',
  pod_abnormal_count: 'cluster_pod_abnormal_count',
  pod_completed_count: 'cluster_pod_succeeded_count',
  // InfiniBand / RDMA. These read the Prometheus recording rules, so each metric
  // is a single cluster-wide series.
  ib_health: 'cluster_ib_health',
  ib_port_up: 'cluster_ib_port_up',
  ib_port_total: 'cluster_ib_port_total',
  ib_rx_bytes: 'cluster_ib_rx_bytes',
  ib_tx_bytes: 'cluster_ib_tx_bytes',
  ib_link_speed: 'cluster_ib_link_speed',
  ib_rx_errors: 'cluster_ib_rx_errors',
  ib_retrans: 'cluster_ib_retrans',
  ib_discards: 'cluster_ib_discards',
  ib_link_downed: 'cluster_ib_link_downed',
}

@inject('rootStore')
@observer
class ClusterMonitorings extends React.Component {
  constructor(props) {
    super(props)

    this.monitorStore = new ClusterMonitorStore({
      cluster: props.match.params.cluster,
    })
  }

  get metrics() {
    return this.monitorStore.data
  }

  fetchData = params => {
    this.monitorStore.fetchMetrics({
      metrics: Object.values(MetricTypes),
      ...params,
    })
  }

  getMonitoringCfgs = () => [
    {
      type: 'utilisation',
      title: 'GPU_MEMORY_USAGE',
      unit: '%',
      legend: ['USAGE'],
      data: get(
        this.metrics,
        `${MetricTypes.gpu_memory_utilisation}.data.result`
      ),
    },
    {
      type: 'utilisation',
      title: 'GPU_USAGE',
      unit: '%',
      legend: ['USAGE'],
      data: get(this.metrics, `${MetricTypes.gpu_utilization}.data.result`),
    },
    {
      type: 'usage',
      title: 'GPU_ALLOCATION_COUNT',
      unitType: 'gpu',
      legend: ['GPU_ALLOCATION_COUNT'],
      data: get(this.metrics, `${MetricTypes.gpu_allocated}.data.result`),
    },
    {
      type: 'utilisation',
      title: 'CPU_USAGE',
      unit: '%',
      legend: ['USAGE'],
      data: get(this.metrics, `${MetricTypes.cpu_utilisation}.data.result`),
    },
    {
      type: 'utilisation',
      title: 'MEMORY_USAGE',
      unit: '%',
      legend: ['USAGE'],
      data: get(this.metrics, `${MetricTypes.memory_utilisation}.data.result`),
    },
    {
      type: 'load',
      title: 'AVERAGE_CPU_LOAD',
      legend: [
        t('TIME_M', { num: 1 }),
        t('TIME_M', { num: 5 }),
        t('TIME_M', { num: 15 }),
      ],
      data: [
        get(this.metrics, `${MetricTypes.cpu_load1}.data.result[0]`, {}),
        get(this.metrics, `${MetricTypes.cpu_load5}.data.result[0]`, {}),
        get(this.metrics, `${MetricTypes.cpu_load15}.data.result[0]`, {}),
      ],
    },
    {
      type: 'usage',
      title: 'DISK_USAGE',
      unitType: 'disk',
      legend: ['USAGE'],
      data: get(this.metrics, `${MetricTypes.disk_size_usage}.data.result`),
    },
    {
      type: 'utilisation',
      title: 'INODE_USAGE',
      unit: '%',
      legend: ['USAGE'],
      data: get(
        this.metrics,
        `${MetricTypes.disk_inode_utilisation}.data.result`
      ),
      renderTooltip: () => {
        const usageData = getChartData({
          unit: '',
          legend: ['USAGE'],
          valuesData: [
            get(
              this.metrics,
              `${MetricTypes.disk_inode_usage}.data.result[0].values`,
              []
            ),
          ],
        })
        const totalData = getChartData({
          unit: '',
          legend: ['USAGE'],
          valuesData: [
            get(
              this.metrics,
              `${MetricTypes.disk_inode_total}.data.result[0].values`,
              []
            ),
          ],
        })

        return <CustomTooltip usageData={usageData} totalData={totalData} />
      },
    },
    {
      type: 'throughput',
      title: 'DISK_THROUGHPUT',
      unitType: 'throughput',
      legend: ['READ', 'WRITE'],
      data: [
        get(
          this.metrics,
          `${MetricTypes.disk_read_throughput}.data.result[0]`,
          {}
        ),
        get(
          this.metrics,
          `${MetricTypes.disk_write_throughput}.data.result[0]`,
          {}
        ),
      ],
    },
    {
      type: 'iops',
      title: 'IOPS',
      legend: ['READ', 'WRITE'],
      data: [
        get(this.metrics, `${MetricTypes.disk_read_iops}.data.result[0]`, {}),
        get(this.metrics, `${MetricTypes.disk_write_iops}.data.result[0]`, {}),
      ],
    },
    {
      type: 'bandwidth',
      title: 'NETWORK_TRAFFIC',
      unitType: 'bandwidth',
      legend: ['OUT', 'IN'],
      data: [
        get(this.metrics, `${MetricTypes.net_transmitted}.data.result[0]`, {}),
        get(this.metrics, `${MetricTypes.net_received}.data.result[0]`, {}),
      ],
    },
    {
      type: 'count',
      title: 'POD_STATUS',
      unit: '',
      legend: ['RUNNING', 'COMPLETED', 'WARNING'],
      data: [
        get(
          this.metrics,
          `${MetricTypes.pod_running_count}.data.result[0]`,
          {}
        ),
        get(
          this.metrics,
          `${MetricTypes.pod_completed_count}.data.result[0]`,
          {}
        ),
        get(
          this.metrics,
          `${MetricTypes.pod_abnormal_count}.data.result[0]`,
          {}
        ),
      ],
    },
    {
      type: 'utilisation',
      title: 'RDMA_HEALTH',
      unit: '%',
      legend: ['RDMA_HEALTH'],
      data: get(this.metrics, `${MetricTypes.ib_health}.data.result[0]`, {}),
    },
    {
      type: 'count',
      title: 'RDMA_PORT_STATUS',
      unit: '',
      legend: ['RDMA_PORT_UP', 'RDMA_PORT_TOTAL'],
      data: [
        get(this.metrics, `${MetricTypes.ib_port_up}.data.result[0]`, {}),
        get(this.metrics, `${MetricTypes.ib_port_total}.data.result[0]`, {}),
      ],
    },
    {
      type: 'throughput',
      title: 'RDMA_THROUGHPUT',
      unitType: 'throughput',
      legend: ['RDMA_OUT', 'RDMA_IN'],
      data: [
        get(this.metrics, `${MetricTypes.ib_tx_bytes}.data.result[0]`, {}),
        get(this.metrics, `${MetricTypes.ib_rx_bytes}.data.result[0]`, {}),
      ],
    },
    {
      type: 'throughput',
      title: 'RDMA_LINK_RATE',
      unitType: 'ib-link-rate',
      legend: ['RDMA_LINK_SPEED_TOTAL'],
      data: get(
        this.metrics,
        `${MetricTypes.ib_link_speed}.data.result[0]`,
        {}
      ),
    },
    {
      type: 'count',
      title: 'RDMA_ERRORS',
      unit: '',
      legend: ['RDMA_RX_ERRORS', 'RDMA_RETRANS', 'RDMA_DISCARDS'],
      data: [
        get(this.metrics, `${MetricTypes.ib_rx_errors}.data.result[0]`, {}),
        get(this.metrics, `${MetricTypes.ib_retrans}.data.result[0]`, {}),
        get(this.metrics, `${MetricTypes.ib_discards}.data.result[0]`, {}),
      ],
    },
    {
      type: 'count',
      title: 'RDMA_LINK_DOWNED',
      unit: '',
      legend: ['RDMA_LINK_DOWNED'],
      data: get(
        this.metrics,
        `${MetricTypes.ib_link_downed}.data.result[0]`,
        {}
      ),
    },
  ]

  render() {
    const { isLoading, isRefreshing } = this.monitorStore
    const configs = this.getMonitoringCfgs()

    return (
      <MonitoringController
        title={t('PHYSICAL_RESOURCES_MONITORING')}
        step="2m"
        times={50}
        onFetch={this.fetchData}
        loading={isLoading}
        refreshing={isRefreshing}
        isEmpty={isEmpty(this.metrics)}
      >
        <div className={styles.content}>
          {configs.map(item => {
            const config = getAreaChartOps(item)

            if (isEmpty(config.data)) return null

            return (
              <div key={item.title} className={styles.box}>
                <SimpleArea width="100%" height={190} {...config} />
              </div>
            )
          })}
        </div>
      </MonitoringController>
    )
  }
}

export default ClusterMonitorings
