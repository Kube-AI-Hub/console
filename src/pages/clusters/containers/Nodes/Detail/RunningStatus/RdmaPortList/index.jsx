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
import { Table } from '@kube-design/components'
import { Panel, Status } from 'components/Base'

import { getSuitableValue } from 'utils/monitoring'

// The IB logical port states, from the kernel's enum. Only Active is serving
// traffic; Init/Armed mean the link is coming up or degraded.
const STATE_NAME_KEY = {
  active: 'RDMA_PORT_STATE_ACTIVE',
  down: 'RDMA_PORT_STATE_DOWN',
  init: 'RDMA_PORT_STATE_INIT',
  armed: 'RDMA_PORT_STATE_ARMED',
  'act-defer': 'RDMA_PORT_STATE_ACT_DEFER',
  'no-change': 'RDMA_PORT_STATE_NO_CHANGE',
  unknown: 'UNKNOWN',
}

const RdmaPortList = ({ dataSource = [], isLoading = false }) => {
  const columns = [
    {
      title: t('RDMA_PORT_DEVICE'),
      key: 'device',
      isHideable: true,
      width: '10%',
      render: record => record.device,
    },
    {
      title: t('RDMA_PORT_NUMBER'),
      key: 'port',
      isHideable: true,
      width: '6%',
      render: record => record.port,
    },
    {
      title: t('RDMA_PORT_STATE'),
      key: 'stateName',
      isHideable: true,
      render: record => (
        <Status
          type={record.healthy ? 'Running' : 'Warning'}
          name={t(STATE_NAME_KEY[record.stateName] || 'UNKNOWN')}
        />
      ),
    },
    {
      title: t('RDMA_PORT_LINK_SPEED'),
      key: 'linkSpeed',
      isHideable: true,
      render: record =>
        record.linkSpeed
          ? getSuitableValue(record.linkSpeed, 'ib-link-rate')
          : '-',
    },
    {
      title: t('RDMA_PORT_HCA'),
      key: 'hcaType',
      isHideable: true,
      overFlow: 'ellipsis',
      render: record => record.hcaType || '-',
    },
    {
      title: t('RDMA_PORT_FIRMWARE'),
      key: 'firmware',
      isHideable: true,
      render: record => record.firmware || '-',
    },
    {
      title: t('RDMA_PORT_RESOURCE'),
      key: 'rdmaAllocated',
      isHideable: true,
      render: record =>
        record.rdmaAllocated
          ? t('RDMA_PORT_RESOURCE_READY')
          : t('RDMA_PORT_RESOURCE_MISSING'),
    },
  ]

  return (
    <Panel title={t('RDMA_PORT_LIST')} empty={t('RDMA_PORT_EMPTY_TIPS')}>
      <Table
        rowKey="_rowKey"
        dataSource={dataSource}
        columns={columns}
        isLoading={isLoading}
        emptyText={t('RDMA_PORT_EMPTY_TIPS')}
      />
    </Panel>
  )
}

export default RdmaPortList
