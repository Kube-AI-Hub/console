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
import { isEmpty, get } from 'lodash'
import { Tooltip, Icon } from '@kube-design/components'

import { cpuFormat, memoryFormat, getVendorDisplayName } from 'utils'
import { ICON_TYPES, NODE_STATUS } from 'utils/constants'
import { getNodeStatus } from 'utils/node'
import { getValueByUnit } from 'utils/monitoring'
import NodeStore from 'stores/node'
import NodeMonitoringStore from 'stores/monitoring/node'
import KubeCtlModal from 'components/Modals/KubeCtl'
import GpuVirtModeModal from 'components/Modals/Node/GpuVirtMode'

import { withClusterList, ListPage } from 'components/HOCs/withList'

import { Avatar, Status, Panel, Text, Modal } from 'components/Base'

import Banner from 'components/Cards/Banner'
import Table from 'components/Tables/List'

import { toJS } from 'mobx'
import * as styles from './index.scss'

const MetricTypes = {
  gpu_used: 'node_gpu_usage',
  gpu_total: 'node_gpu_total',
  gpu_utilisation: 'node_gpu_utilisation',
  gpu_allocated: 'node_gpu_allocated',
  gpu_memory_used: 'node_gpu_memory_usage',
  gpu_memory_total: 'node_gpu_memory_total',
  gpu_memory_utilisation: 'node_gpu_memory_utilisation',
  cpu_used: 'node_cpu_usage',
  cpu_total: 'node_cpu_total',
  cpu_utilisation: 'node_cpu_utilisation',
  memory_used: 'node_memory_usage_wo_cache',
  memory_total: 'node_memory_total',
  memory_utilisation: 'node_memory_utilisation',
  pod_used: 'node_pod_running_count',
  pod_total: 'node_pod_quota',
}

export default
@withClusterList({
  store: new NodeStore(),
  name: 'CLUSTER_NODE',
  module: 'nodes',
})
class Nodes extends React.Component {
  store = this.props.store

  monitoringStore = new NodeMonitoringStore({ cluster: this.cluster })

  componentDidMount() {
    this.store.fetchCount(this.props.match.params)
  }

  get cluster() {
    return this.props.match.params.cluster
  }

  get tips() {
    return [
      {
        title: t('NODE_TYPES_Q'),
        description: t('NODE_TYPES_A'),
      },
      {
        title: t('WHAT_IS_NODE_TAINTS_Q'),
        description: t('WHAT_IS_NODE_TAINTS_A'),
      },
    ]
  }

  get itemActions() {
    const { store, clusterStore, routing, trigger, name } = this.props
    return [
      {
        key: 'uncordon',
        icon: 'start',
        text: t('UNCORDON'),
        action: 'edit',
        show: item =>
          item.importStatus === 'success' && this.getUnschedulable(item),
        onClick: item => store.uncordon(item).then(routing.query),
      },
      {
        key: 'cordon',
        icon: 'stop',
        text: t('CORDON'),
        action: 'edit',
        show: item =>
          item.importStatus === 'success' && !this.getUnschedulable(item),
        onClick: item => store.cordon(item).then(routing.query),
      },
      {
        key: 'terminal',
        icon: 'terminal',
        text: t('OPEN_TERMINAL'),
        action: 'edit',
        show: item => item.importStatus === 'success' && this.getReady(item),
        onClick: item => this.handleOpenTerminal(item),
      },
      {
        key: 'logs',
        icon: 'eye',
        text: t('VIEW_LOG'),
        action: 'edit',
        show: item => item.importStatus !== 'success',
        onClick: () =>
          trigger('node.add.log', { detail: toJS(clusterStore.detail) }),
      },
      {
        key: 'setGpuVirtMode',
        icon: 'gpu',
        text: t('SET_VGPU_MODE'),
        action: 'edit',
        show: item => this.hasGpuNode(item),
        onClick: item => {
          const modal = Modal.open({
            modal: GpuVirtModeModal,
            detail: toJS(item),
            onOk: () => {
              Modal.close(modal)
              routing.query()
            },
          })
        },
      },
      {
        key: 'delete',
        icon: 'trash',
        text: t('DELETE'),
        action: 'delete',
        show: item => item.importStatus === 'failed',
        onClick: item =>
          trigger('resource.delete', {
            type: name,
            detail: item,
            success: routing.query,
          }),
      },
    ]
  }

  hasGpuNode = record => {
    const nodeInfo = get(record, 'status.nodeInfo') || record.nodeInfo || {}
    return !!(
      nodeInfo.gpuVendor ||
      nodeInfo.virtualCardMode ||
      get(record, 'labels.xpu-vendor')
    )
  }

  get tableActions() {
    const { trigger, routing, clusterStore, tableProps } = this.props
    const actions = []
    if (clusterStore.detail.kkName) {
      actions.push({
        key: 'add',
        type: 'control',
        text: t('ADD'),
        action: 'create',
        onClick: () =>
          trigger('node.add', {
            kkName: clusterStore.detail.kkName || 'ddd',
          }),
      })
    }

    return {
      ...tableProps.tableActions,
      actions,
      selectActions: [
        {
          key: 'taint',
          type: 'default',
          text: t('EDIT_TAINTS'),
          action: 'edit',
          onClick: () =>
            trigger('node.taint.batch', {
              success: routing.query,
            }),
        },
      ],
    }
  }

  getData = async params => {
    await this.store.fetchList({
      ...params,
      ...this.props.match.params,
    })

    await this.monitoringStore.fetchMetrics({
      ...this.props.match.params,
      resources: this.store.list.data.map(node => node.name),
      metrics: Object.values(MetricTypes),
      last: true,
    })
  }

  getUnschedulable = record => {
    const taints = record.taints

    return taints.some(
      taint => taint.key === 'node.kubernetes.io/unschedulable'
    )
  }

  getReady = record => {
    const conditions = record.conditions

    return conditions.some(
      condition => condition.type === 'Ready' && condition.status === 'True'
    )
  }

  handleOpenTerminal = record => {
    const modal = Modal.open({
      onOk: () => {
        Modal.close(modal)
      },
      modal: KubeCtlModal,
      cluster: this.cluster,
      title: record.name,
      nodename: record.name,
      isEdgeNode: true,
    })
  }

  getLastValue = (node, type, unit) => {
    const metricsData = this.monitoringStore.data
    const result = get(metricsData[type], 'data.result') || []
    const metrics = result.find(item => get(item, 'metric.node') === node.name)
    return getValueByUnit(get(metrics, 'value[1]', 0), unit)
  }

  getRecordMetrics = (record, configs) => {
    const metrics = {}
    configs.forEach(cfg => {
      metrics[cfg.type] = parseFloat(
        this.getLastValue(record, MetricTypes[cfg.type], cfg.unit)
      )
    })
    return metrics
  }

  renderTaintsTip = data => (
    <div>
      <div>{t('TAINTS')}:</div>
      <div>
        {data.map(item => {
          const text = `${item.key}=${item.value || ''}:${item.effect}`
          return <div key={text}>{text}</div>
        })}
      </div>
    </div>
  )

  renderXpuTitle = () => {
    const renderXpuTip = (
      <div>
        <div>{t('XPU_TYPE_TIP_SOURCE')}</div>
        <div>{t('XPU_TYPE_TIP_FORMAT')}</div>
        <div>{t('XPU_TYPE_TIP_EXAMPLES')}</div>
        <div>{t('XPU_TYPE_TIP_DEFAULT')}</div>
      </div>
    )
    return (
      <div className={styles.mode_title}>
        {t('XPU_TYPE')}
        <Tooltip content={renderXpuTip}>
          <Icon name="question" size={16} className={styles.question}></Icon>
        </Tooltip>
      </div>
    )
  }

  getStatus() {
    return NODE_STATUS.map(status => ({
      text: t(status.text),
      value: status.value,
    }))
  }

  getRoles() {
    return [
      {
        text: t('CONTROL_PLANE'),
        value: 'master',
      },
      {
        text: t('WORKER'),
        value: 'worker',
      },
    ]
  }

  getColumns = () => {
    const { module, prefix, getSortOrder, getFilteredValue } = this.props
    return [
      {
        title: t('NAME'),
        dataIndex: 'name',
        sorter: true,
        sortOrder: getSortOrder('name'),
        search: true,
        render: (name, record) => (
          <Avatar
            icon={ICON_TYPES[module]}
            iconSize={40}
            to={record.importStatus !== 'success' ? null : `${prefix}/${name}`}
            title={name}
            desc={record.ip}
          />
        ),
      },
      {
        title: t('STATUS'),
        dataIndex: 'status',
        filters: this.getStatus(),
        filteredValue: getFilteredValue('status'),
        isHideable: true,
        search: true,
        render: (_, record) => {
          const status = getNodeStatus(record)
          const taints = record.taints

          return (
            <div className={styles.status}>
              <Status
                type={status}
                name={t(`NODE_STATUS_${status.toUpperCase()}`)}
              />
              {!isEmpty(taints) && record.importStatus === 'success' && (
                <Tooltip content={this.renderTaintsTip(taints)}>
                  <span className={styles.taints}>{taints.length}</span>
                </Tooltip>
              )}
            </div>
          )
        },
      },
      {
        title: t('ROLE'),
        dataIndex: 'role',
        filters: this.getRoles(),
        filteredValue: getFilteredValue('role'),
        isHideable: true,
        search: true,
        render: roles =>
          roles.indexOf('master') === -1 ? t('WORKER') : t('CONTROL_PLANE'),
      },
      {
        title: t('GPU_USAGE'),
        key: 'gpu',
        isHideable: true,
        render: record => {
          const metrics = this.getRecordMetrics(record, [
            {
              type: 'gpu_used',
            },
            {
              type: 'gpu_total',
            },
            {
              type: 'gpu_utilisation',
            },
            {
              type: 'gpu_allocated',
            },
          ])

          return (
            <Text
              title={
                <div className={styles.resource}>
                  <span>{`${Math.round(metrics.gpu_utilisation * 100)}%`}</span>
                  <span className={styles.secondary}>
                    (
                    {`${metrics.gpu_used.toFixed(2)}/${metrics.gpu_total} ${t(
                      'GPU_CARD_UNIT'
                    )}`}
                    )
                  </span>
                  {metrics.gpu_utilisation >= 0.9 && (
                    <Icon name="exclamation" />
                  )}
                </div>
              }
              description={`${t('ALLOCATED_SCAP')}: ${
                metrics.gpu_allocated
              } ${t('GPU_CARD_UNIT')}`}
            />
          )
        },
      },
      {
        title: t('GPU_MEMORY_USAGE'),
        key: 'gpu_memory',
        isHideable: true,
        render: record => {
          const metrics = this.getRecordMetrics(record, [
            {
              type: 'gpu_memory_used',
              unit: 'Gi',
            },
            {
              type: 'gpu_memory_total',
              unit: 'Gi',
            },
            {
              type: 'gpu_memory_utilisation',
            },
          ])

          return (
            <Text
              title={
                <div className={styles.resource}>
                  <span>{`${Math.round(
                    metrics.gpu_memory_utilisation * 100
                  )}%`}</span>
                  <span className={styles.secondary}>
                    (
                    {`${metrics.gpu_memory_used}/${metrics.gpu_memory_total} GiB`}
                    )
                  </span>
                  {metrics.gpu_memory_utilisation >= 0.9 && (
                    <Icon name="exclamation" />
                  )}
                </div>
              }
            />
          )
        },
      },
      {
        title: t('CPU_USAGE'),
        key: 'cpu',
        isHideable: true,
        render: record => {
          const metrics = this.getRecordMetrics(record, [
            {
              type: 'cpu_used',
              unit: 'Core',
            },
            {
              type: 'cpu_total',
              unit: 'Core',
            },
            {
              type: 'cpu_utilisation',
            },
          ])
          const cpuRequests = cpuFormat(
            get(record, 'annotations["node.kubesphere.io/cpu-requests"]')
          )

          return (
            <Text
              title={
                <div className={styles.resource}>
                  <span>{`${Math.round(metrics.cpu_utilisation * 100)}%`}</span>
                  <span className={styles.secondary}>
                    (
                    {`${metrics.cpu_used}/${metrics.cpu_total} ${t('CORE_PL')}`}
                    )
                  </span>
                  {metrics.cpu_utilisation >= 0.9 && (
                    <Icon name="exclamation" />
                  )}
                </div>
              }
              description={`${t('ALLOCATED_SCAP')}: ${cpuRequests} ${t(
                'CORE_PL'
              )}`}
            />
          )
        },
      },
      {
        title: t('MEMORY_USAGE'),
        key: 'memory',
        isHideable: true,
        render: record => {
          const metrics = this.getRecordMetrics(record, [
            {
              type: 'memory_used',
              unit: 'Gi',
            },
            {
              type: 'memory_total',
              unit: 'Gi',
            },
            {
              type: 'memory_utilisation',
            },
          ])
          const memoryRequests = memoryFormat(
            get(record, 'annotations["node.kubesphere.io/memory-requests"]'),
            'Gi'
          )

          return (
            <Text
              title={
                <div className={styles.resource}>
                  <span>{`${Math.round(
                    metrics.memory_utilisation * 100
                  )}%`}</span>
                  <span className={styles.secondary}>
                    ({`${metrics.memory_used}/${metrics.memory_total} GiB`})
                  </span>
                  {metrics.memory_utilisation >= 0.9 && (
                    <Icon name="exclamation" />
                  )}
                </div>
              }
              description={`${t('ALLOCATED_SCAP')}: ${memoryRequests} GiB`}
            />
          )
        },
      },
      {
        title: t('POD_PL'),
        key: 'pods',
        isHideable: true,
        render: record => {
          const metrics = this.getRecordMetrics(record, [
            {
              type: 'pod_used',
            },
            {
              type: 'pod_total',
            },
          ])
          const uitilisation = metrics.pod_total
            ? parseFloat(metrics.pod_used / metrics.pod_total)
            : 0

          return (
            <Text
              title={`${Math.round(uitilisation * 100)}%`}
              description={`${metrics.pod_used}/${metrics.pod_total}`}
            />
          )
        },
      },
      {
        title: this.renderXpuTitle(),
        key: 'xpu',
        isHideable: true,
        render: record => {
          let vendor = get(record, 'labels.xpu-vendor')
          let model = get(record, 'labels.xpu-model')
          const xpu = get(record, 'labels.xpu')
          if (!vendor && !model && xpu && xpu !== 'CPU') {
            const idx = xpu.indexOf('-')
            if (idx > 0) {
              vendor = xpu.slice(0, idx)
              model = xpu.slice(idx + 1)
            }
          }
          if (!vendor && !model) {
            return <Text title="CPU" description="-" />
          }
          return (
            <Text
              title={getVendorDisplayName(vendor) || vendor || '-'}
              description={model || '-'}
            />
          )
        },
      },
      {
        title: t('GPU_VIRT_MODE'),
        key: 'gpuVirtMode',
        isHideable: true,
        render: record => {
          if (!this.hasGpuNode(record)) return '-'
          const nodeInfo =
            get(record, 'status.nodeInfo') || record.nodeInfo || {}
          const gpuModeStatus = get(record, 'status.nodeInfo.gpuModeStatus')
          const modeToDisplay = mode =>
            mode === 'default' ? t('GPU_MODE_DEFAULT') : mode
          let displayText = nodeInfo.virtualCardMode
            ? modeToDisplay(nodeInfo.virtualCardMode)
            : '-'
          if (gpuModeStatus?.status === 'in_progress') {
            displayText = t('GPU_VIRT_MODE_SWITCHING', {
              mode: gpuModeStatus.mode || '',
            })
          } else if (gpuModeStatus?.status === 'failed') {
            displayText = gpuModeStatus.message
              ? `${t('GPU_VIRT_MODE_SWITCH_FAILED')}: ${gpuModeStatus.message}`
              : t('GPU_VIRT_MODE_SWITCH_FAILED')
          } else if (
            gpuModeStatus?.status === 'completed' &&
            gpuModeStatus.mode
          ) {
            displayText = modeToDisplay(gpuModeStatus.mode)
          }
          return displayText
        },
      },
    ]
  }

  renderCPUTooltip = record => {
    const content = (
      <p>
        {cpuFormat(
          get(record, 'annotations["node.kubesphere.io/cpu-limits"]')
        ) === 1
          ? t('CPU_LIMIT_SI', {
              core: cpuFormat(
                get(record, 'annotations["node.kubesphere.io/cpu-limits"]')
              ),
              percent: get(
                record,
                'annotations["node.kubesphere.io/cpu-limits-fraction"]'
              ),
            })
          : t('CPU_LIMIT_PL', {
              core: cpuFormat(
                get(record, 'annotations["node.kubesphere.io/cpu-limits"]')
              ),
              percent: get(
                record,
                'annotations["node.kubesphere.io/cpu-limits-fraction"]'
              ),
            })}
      </p>
    )
    return (
      <Tooltip content={content} placement="top">
        <Text
          title={
            cpuFormat(
              get(record, 'annotations["node.kubesphere.io/cpu-requests"]')
            ) === 1
              ? t('CPU_REQUEST_SI', {
                  core: cpuFormat(
                    get(
                      record,
                      'annotations["node.kubesphere.io/cpu-requests"]'
                    )
                  ),
                  percent: get(
                    record,
                    'annotations["node.kubesphere.io/cpu-requests-fraction"]'
                  ),
                })
              : t('CPU_REQUEST_PL', {
                  core: cpuFormat(
                    get(
                      record,
                      'annotations["node.kubesphere.io/cpu-requests"]'
                    )
                  ),
                  percent: get(
                    record,
                    'annotations["node.kubesphere.io/cpu-requests-fraction"]'
                  ),
                })
          }
          description={t('RESOURCE_REQUEST')}
        />
      </Tooltip>
    )
  }

  renderMemoryTooltip = record => {
    const content = (
      <p>
        {t('MEMORY_LIMIT_VALUE', {
          gib: memoryFormat(
            get(record, 'annotations["node.kubesphere.io/memory-limits"]'),
            'Gi'
          ),
          percent: get(
            record,
            'annotations["node.kubesphere.io/memory-limits-fraction"]'
          ),
        })}
      </p>
    )
    return (
      <Tooltip content={content} placement="top">
        <Text
          title={t('MEMORY_REQUEST_VALUE', {
            gib: memoryFormat(
              get(record, 'annotations["node.kubesphere.io/memory-requests"]'),
              'Gi'
            ),
            percent: get(
              record,
              'annotations["node.kubesphere.io/memory-requests-fraction"]'
            ),
          })}
          description={t('RESOURCE_REQUEST')}
        />
      </Tooltip>
    )
  }

  renderOverview() {
    const { masterNum, list } = this.store
    const totalCount = list.total
    return (
      <Panel className="margin-b12">
        <div className={styles.overview}>
          <Text
            icon="nodes"
            title={totalCount}
            description={totalCount === 1 ? t(`NODE_SI`) : t(`NODE_PL`)}
          />
          <Text
            title={masterNum}
            description={
              masterNum === 1 ? t('MASTER_NODE_SI') : t('MASTER_NODE_PL')
            }
          />
        </div>
      </Panel>
    )
  }

  render() {
    const { bannerProps, tableProps } = this.props
    const isLoadingMonitor = this.monitoringStore.isLoading
    return (
      <ListPage {...this.props} getData={this.getData} noWatch>
        <Banner
          {...bannerProps}
          title={t('CLUSTER_NODE_PL')}
          tips={this.tips}
        />
        {this.renderOverview()}
        <Table
          {...tableProps}
          itemActions={this.itemActions}
          tableActions={this.tableActions}
          columns={this.getColumns()}
          isLoading={tableProps.isLoading || isLoadingMonitor}
        />
      </ListPage>
    )
  }
}
