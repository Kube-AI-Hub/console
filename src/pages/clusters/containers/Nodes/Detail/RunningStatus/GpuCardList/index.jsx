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
import { Link, withRouter } from 'react-router-dom'
import { Table, Tooltip } from '@kube-design/components'
import { Panel, Status } from 'components/Base'
import { getVendorDisplayName } from 'utils'

const GpuCardList = ({ dataSource = [], isLoading = false, match }) => {
  const { cluster, node } = match.params
  const columns = [
    {
      title: t('GPU_CARD_INDEX'),
      key: 'index',
      isHideable: true,
      width: '5%',
      render: record => record.index,
    },
    {
      title: t('GPU_CARD_ID'),
      key: 'uuid',
      isHideable: true,
      width: '10%',
      overFlow: 'ellipsis',
      render: record => {
        const gpuDetailUrl = `/clusters/${cluster}/nodes/${node}/gpus/${encodeURIComponent(
          record.uuid
        )}/status`
        const returnTo = `/clusters/${cluster}/nodes/${node}/status`
        const linkTo = {
          pathname: gpuDetailUrl,
          state: { returnTo, returnToLabel: t('RUNNING_STATUS') },
        }
        return (
          <Tooltip content={record.uuid}>
            <Link
              to={linkTo}
              style={{
                display: 'inline-block',
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {record.uuid}
            </Link>
          </Tooltip>
        )
      },
    },
    {
      title: t('GPU_CARD_STATUS'),
      key: 'health',
      isHideable: true,
      render: (_, record) => {
        return (
          <Status
            type={record.health ? 'Running' : 'Warning'}
            name={record.health ? t('HEALTHY') : t('SUB_HEALTHY')}
          />
        )
      },
    },
    {
      title: t('GPU_CARD_MODEL'),
      key: 'type',
      isHideable: true,
      render: record => record.type,
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
      isHideable: true,
      render: record => getVendorDisplayName(record.deviceVendor) || '-',
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
      render: record => `${record.vgpuUsed}/${record.vgpuTotal}`,
    },
    {
      title: t('GPU_CARD_COMPUTE'),
      key: 'gpuCoreTotal',
      isHideable: true,
      render: record => `${record.gpuCoreUsed}/${record.gpuCoreTotal}`,
    },
    {
      title: t('GPU_CARD_MEMORY'),
      key: 'gpuMemoryTotal',
      isHideable: true,
      render: record => {
        // convert to GiB and round to 2 decimal places
        const gpuMemoryTotal = (record.gpuMemoryTotal / 1024).toFixed(2)
        const gpuMemoryUsed = (record.gpuMemoryUsed / 1024).toFixed(2)
        return `${gpuMemoryUsed}/${gpuMemoryTotal} GiB`
      },
    },
  ]

  return (
    <Panel title={t('GPU_CARD_LIST')} empty={t('NO_GPU_TIPS')}>
      <Table
        rowKey="uuid"
        dataSource={dataSource}
        className={'table-2-6 table-4-3'}
        columns={columns}
        isLoading={isLoading}
        emptyText={t('NO_GPU_TIPS')}
      />
    </Panel>
  )
}

export default withRouter(GpuCardList)
