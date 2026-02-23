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
import { Link } from 'react-router-dom'
import { Tooltip } from '@kube-design/components'
import { Avatar, Panel, Status, Text } from 'components/Base'
import { ICON_TYPES } from 'utils/constants'
import { getVendorDisplayName } from 'utils'

import { withClusterList, ListPage } from 'components/HOCs/withList'

import Banner from 'components/Cards/Banner'
import GpuResourceTable from 'clusters/components/ResourceTable/GpuResourceTable'

import GpuStore from 'stores/gpu'

export default
@withClusterList({
  store: new GpuStore(),
  name: 'GPU_CARD',
  module: 'gpus',
  rowKey: '_rowKey',
})
class Gpus extends React.Component {
  store = this.props.store

  get cluster() {
    return this.props.match.params.cluster
  }

  get nodeBasePath() {
    return `/clusters/${this.cluster}/nodes`
  }

  get tips() {
    return []
  }

  get tableActions() {
    return this.props.tableProps.tableActions
  }

  getData = async params => {
    await this.store.fetchList({
      ...params,
      ...this.props.match.params,
    })
  }

  getFilterColumns() {
    return [
      {
        dataIndex: 'uuid',
        title: t('FILTER_UUID'),
        search: true,
      },
      {
        dataIndex: 'labelSelector',
        title: t('FILTER_LABEL_SELECTOR'),
        search: true,
      },
      {
        dataIndex: 'deviceVendor',
        title: t('FILTER_DEVICE_VENDOR'),
        search: true,
        filters: [
          { text: t('XPU_VENDOR_NVIDIA'), value: 'nvidia' },
          { text: t('XPU_VENDOR_CAMBRICON'), value: 'cambricon' },
          { text: t('XPU_VENDOR_ASCEND'), value: 'ascend' },
          { text: t('XPU_VENDOR_HYGON'), value: 'hygon' },
          { text: t('XPU_VENDOR_METAX'), value: 'metax' },
          { text: t('XPU_VENDOR_ILUVATAR'), value: 'iluvatar' },
        ],
      },
      {
        dataIndex: 'type',
        title: t('FILTER_TYPE'),
        search: true,
      },
      {
        dataIndex: 'status',
        title: t('FILTER_STATUS'),
        search: true,
        filters: [
          { text: t('HEALTHY'), value: 'healthy' },
          { text: t('SUB_HEALTHY'), value: 'unhealthy' },
        ],
      },
    ]
  }

  getColumns = () => {
    const { getSortOrder, getFilteredValue } = this.props
    const basePath = this.nodeBasePath
    return [
      {
        title: t('NODE'),
        dataIndex: 'nodeName',
        sorter: true,
        sortOrder: getSortOrder('nodeName'),
        isHideable: true,
        width: '14%',
        render: (nodeName, record) => {
          if (!nodeName) return '-'
          const nodeUrl = `${basePath}/${nodeName}/status?from=gpus`
          return (
            <Avatar
              icon={ICON_TYPES.nodes}
              iconSize={40}
              to={nodeUrl}
              title={nodeName}
              desc={record.nodeIP || '-'}
            />
          )
        },
      },
      {
        title: t('GPU_CARD_INDEX'),
        key: 'index',
        dataIndex: 'index',
        sorter: true,
        sortOrder: getSortOrder('index'),
        isHideable: true,
        width: '5%',
        render: (_, record) =>
          record.index !== undefined && record.index !== null
            ? String(record.index)
            : '-',
      },
      {
        title: t('GPU_CARD_ID'),
        key: 'uuid',
        dataIndex: 'uuid',
        sorter: true,
        sortOrder: getSortOrder('uuid'),
        isHideable: true,
        width: '10%',
        overFlow: 'ellipsis',
        render: (uuid, record) => {
          const nodeName = record.nodeName || ''
          const gpuDetailUrl = `${basePath}/${nodeName}/gpus/${encodeURIComponent(
            uuid || ''
          )}/status`
          return (
            <Tooltip content={uuid}>
              <Link
                to={gpuDetailUrl}
                style={{
                  display: 'inline-block',
                  width: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {uuid}
              </Link>
            </Tooltip>
          )
        },
      },
      {
        title: t('GPU_CARD_STATUS'),
        key: 'health',
        dataIndex: 'status',
        filters: [
          { text: t('HEALTHY'), value: 'healthy' },
          { text: t('SUB_HEALTHY'), value: 'unhealthy' },
        ],
        filteredValue: getFilteredValue('status'),
        isHideable: true,
        render: (_, record) => (
          <Status
            type={record.health ? 'Running' : 'Warning'}
            name={record.health ? t('HEALTHY') : t('SUB_HEALTHY')}
          />
        ),
      },
      {
        title: t('GPU_CARD_MODEL'),
        key: 'type',
        isHideable: true,
        render: record => record.type || '-',
      },
      {
        title: t('GPU_CARD_NUMA'),
        key: 'numa',
        isHideable: true,
        render: record =>
          record.numa !== undefined && record.numa !== null ? record.numa : '-',
      },
      {
        title: t('GPU_CARD_VENDOR'),
        key: 'deviceVendor',
        dataIndex: 'deviceVendor',
        filters: [
          { text: t('XPU_VENDOR_NVIDIA'), value: 'nvidia' },
          { text: t('XPU_VENDOR_CAMBRICON'), value: 'cambricon' },
          { text: t('XPU_VENDOR_ASCEND'), value: 'ascend' },
          { text: t('XPU_VENDOR_HYGON'), value: 'hygon' },
          { text: t('XPU_VENDOR_METAX'), value: 'metax' },
          { text: t('XPU_VENDOR_ILUVATAR'), value: 'iluvatar' },
        ],
        filteredValue: getFilteredValue('deviceVendor'),
        isHideable: true,
        render: value => getVendorDisplayName(value) || '-',
      },
      {
        title: t('GPU_CARD_MODE'),
        key: 'mode',
        isHideable: true,
        render: record => record.mode || '-',
      },
      {
        title: t('GPU_CARD_VGPU'),
        key: 'vgpuUsed',
        isHideable: true,
        render: record => `${record.vgpuUsed || 0}/${record.vgpuTotal || 0}`,
      },
      {
        title: t('GPU_CARD_COMPUTE'),
        key: 'gpuCoreTotal',
        isHideable: true,
        render: record =>
          `${record.gpuCoreUsed || 0}/${record.gpuCoreTotal || 0}`,
      },
      {
        title: t('GPU_CARD_MEMORY'),
        key: 'gpuMemoryTotal',
        isHideable: true,
        render: record => {
          const total = record.gpuMemoryTotal
          const used = record.gpuMemoryUsed
          if (total == null || total === 0) return '-'
          const gpuMemoryTotal = (total / 1024).toFixed(2)
          const gpuMemoryUsed = ((used || 0) / 1024).toFixed(2)
          return `${gpuMemoryUsed}/${gpuMemoryTotal} GiB`
        },
      },
    ]
  }

  renderOverview() {
    const { list } = this.store
    const totalCount = list.total
    return (
      <Panel className="margin-b12">
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <Text icon="gpu" title={totalCount} description={t('GPU_CARD_PL')} />
        </div>
      </Panel>
    )
  }

  render() {
    const { bannerProps, tableProps } = this.props
    const tablePropsWithSearch = {
      ...tableProps,
      columnSearch: this.getFilterColumns(),
    }

    return (
      <ListPage {...this.props} getData={this.getData} noWatch>
        <Banner {...bannerProps} title={t('GPU_CARD_PL')} tips={this.tips} />
        {this.renderOverview()}
        <GpuResourceTable
          {...tablePropsWithSearch}
          cluster={this.cluster}
          itemActions={[]}
          tableActions={{
            ...tableProps.tableActions,
            selectActions: [],
          }}
          columns={this.getColumns()}
          isLoading={tableProps.isLoading}
        />
      </ListPage>
    )
  }
}
