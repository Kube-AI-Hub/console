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
 * GNU Affero General License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with KubeSphere Console.  If not, see <https://www.gnu.org/licenses/>.
 */

import React from 'react'
import { Table } from '@kube-design/components'
import Empty from 'components/Base/Empty'
import { getVendorDisplayName } from 'utils'
import { renderGpuVendorWithIcon } from 'utils/gpuVendors'

export default function GPUModelUsageTable({ data = [] }) {
  if (!data || data.length === 0) {
    return <Empty desc={t('NO_DATA')} />
  }

  const columns = [
    {
      title: t('VENDOR'),
      dataIndex: 'vendor',
      width: 140,
      render: (_, row) =>
        renderGpuVendorWithIcon(
          row.vendor,
          getVendorDisplayName(row.vendor) || row.vendor || '-'
        ),
    },
    {
      title: t('MODEL'),
      dataIndex: 'model',
      width: 160,
    },
    {
      title: t('COUNT'),
      dataIndex: 'count',
      width: 80,
    },
    {
      title: t('GPU_MEMORY'),
      dataIndex: 'gpuMemory',
      width: 180,
      render: (_, row) => {
        const totalMi = Number(row.gpuMemoryTotal) || 0
        const usedMi = Number(row.gpuMemoryUsage) || 0
        const util =
          row.gpuMemoryUtil != null
            ? `${(row.gpuMemoryUtil * 100).toFixed(2)}%`
            : '-'
        const totalGi = totalMi / 1024
        const usedGi = usedMi / 1024
        return (
          <span>
            {util} ({usedGi.toFixed(2)}/{totalGi.toFixed(2)} {t('Gi')})
          </span>
        )
      },
    },
    {
      title: t('GPU_USAGE'),
      dataIndex: 'gpuUtil',
      width: 100,
      render: (_, row) =>
        row.gpuUtil != null ? `${(row.gpuUtil * 100).toFixed(2)}%` : '-',
    },
    {
      title: t('GPU_ALLOCATION_COUNT'),
      dataIndex: 'gpuAllocated',
      width: 180,
      render: (_, row) => {
        const allocated = Number(row.gpuAllocated)
        const total = Number(row.count) || 0
        if (row.gpuAllocated == null) return '-'
        const pct = total > 0 ? ((allocated / total) * 100).toFixed(2) : '0.00'
        return (
          <span>
            {pct}% ({allocated.toFixed(2)}/{total.toFixed(2)}{' '}
            {t('GPU_CARD_UNIT')})
          </span>
        )
      },
    },
  ]

  const dataSource = data.map((item, index) => ({
    ...item,
    _rowKey: `${item.vendor || 'unknown'}-${item.model || '-'}-${index}`,
  }))

  return (
    <Table
      dataSource={dataSource}
      columns={columns}
      rowKey="_rowKey"
      pagination={false}
    />
  )
}
