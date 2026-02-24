/*
 * Copyright (C) 2026 Kube AI Hub.
 *
 * KubeSphere Console is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General License as published by
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
import { withRouter } from 'react-router-dom'
import { observer } from 'mobx-react'
import classNames from 'classnames'
import {
  Button,
  Pagination,
  Level,
  LevelLeft,
  LevelRight,
  Icon,
  Loading,
  Select,
  Table,
} from '@kube-design/components'
import { get } from 'lodash'
import { saveAs } from 'file-saver'
import { getVendorDisplayName } from 'utils'
import { renderGpuVendorWithIcon } from 'utils/gpuVendors'
import Link from 'components/Link'
import Empty from 'components/Base/Empty'

import * as styles from './index.scss'

const SORT_OPTIONS = [
  'node_gpu_memory_utilisation',
  'node_gpu_utilisation',
  'node_gpu_allocated',
]

@observer
class GPURanking extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      sortMetric: SORT_OPTIONS[0],
      sortType: 'desc',
      loading: true,
    }
  }

  get cluster() {
    return this.props.cluster || get(this.props, 'match.params.cluster')
  }

  get apiPath() {
    return globals.app.isMultiCluster
      ? `/kapis/clusters/${this.cluster}/gpu.kubesphere.io/v1alpha1`
      : '/kapis/gpu.kubesphere.io/v1alpha1'
  }

  componentDidMount() {
    this.fetchRanking()
  }

  fetchRanking = async () => {
    this.setState({ loading: true })
    try {
      const { page, limit, sortMetric, sortType } = this.state
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort_metric: sortMetric,
        sort_type: sortType,
      })
      const result = await request.get(
        `${this.apiPath}/gpus/ranking?${params.toString()}`
      )
      const items = result.items || []
      const total = result.totalItems ?? items.length
      this.setState({ data: items, total, loading: false })
    } catch (e) {
      this.setState({ data: [], total: 0, loading: false })
    }
  }

  changeSortMetric = val => {
    this.setState({ sortMetric: val, page: 1 }, this.fetchRanking)
  }

  changeSortType = () => {
    this.setState(
      { sortType: this.state.sortType === 'desc' ? 'asc' : 'desc', page: 1 },
      this.fetchRanking
    )
  }

  changePage = page => {
    this.setState({ page }, this.fetchRanking)
  }

  download = () => {
    const { data } = this.state
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'text/plain;charset=utf-8' })
    saveAs(blob, 'gpu.usage.rank.json')
  }

  toRatioPercentage = num => {
    const n = Number(num)
    if (Number.isNaN(n)) return '-'
    return `${(n * 100).toFixed(2)}%`
  }

  toPercentValue = num => {
    const n = Number(num)
    if (Number.isNaN(n)) return '-'
    return `${n.toFixed(2)}%`
  }

  get columns() {
    const canViewNode = globals.app.hasPermission({
      cluster: this.cluster,
      module: 'nodes',
      action: 'view',
    })
    const { sortMetric } = this.state
    const baseColumns = [
      {
        width: 40,
        key: 'icon',
        render: () => <Icon name="nodes" type="dark" size={40} />,
      },
      {
        title: t('NODE'),
        dataIndex: 'nodeName',
        width: 180,
        render: (val, row) => {
          const link = `/clusters/${this.cluster}/nodes/${val}/status`
          const returnTo =
            this.props.location?.pathname ||
            `/clusters/${this.cluster}/gpu-resource/ranking`
          const linkTo = returnTo
            ? {
                pathname: link,
                state: {
                  returnTo,
                  returnToLabel: t('RESOURCE_USAGE_RANKING'),
                },
              }
            : link
          return (
            <div>
              <h3>
                <Link to={linkTo} auth={canViewNode}>
                  {val}
                </Link>
              </h3>
              <p>{get(row, 'host_ip', get(row, 'hostIP', '-'))}</p>
            </div>
          )
        },
      },
      {
        title: t('INDEX'),
        dataIndex: 'index',
        width: 80,
      },
      {
        title: t('GPU_ID'),
        dataIndex: 'uuid',
        width: 120,
        render: (val, row) => {
          const gpuPath = `/clusters/${this.cluster}/nodes/${
            row.nodeName
          }/gpus/${encodeURIComponent(val || '')}/status`
          const returnTo =
            this.props.location?.pathname ||
            `/clusters/${this.cluster}/gpu-resource/ranking`
          const linkTo = returnTo
            ? {
                pathname: gpuPath,
                state: {
                  returnTo,
                  returnToLabel: t('RESOURCE_USAGE_RANKING'),
                },
              }
            : gpuPath
          return (
            <Link to={linkTo} auth={canViewNode}>
              <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                {val}
              </span>
            </Link>
          )
        },
      },
      {
        title: t('MODEL'),
        dataIndex: 'model',
        width: 120,
      },
      {
        title: t('VENDOR'),
        dataIndex: 'vendor',
        width: 120,
        render: (_, row) =>
          renderGpuVendorWithIcon(
            row.vendor,
            getVendorDisplayName(row.vendor) || row.vendor || '-'
          ),
      },
      {
        title: t('GPU_MEMORY_USAGE'),
        dataIndex: 'gpuMemoryUtil',
        width: 120,
        sort_metric: 'node_gpu_memory_utilisation',
        render: (_, row) => (
          <span>
            {this.toRatioPercentage(row.gpuMemoryUtil)}
            {row.gpuMemoryTotal != null && (
              <span className={styles.sub}>
                {(Number(row.gpuMemoryUsed) / 1024).toFixed(2)}/
                {(Number(row.gpuMemoryTotal) / 1024).toFixed(2)} {t('Gi')}
              </span>
            )}
          </span>
        ),
      },
      {
        title: t('GPU_USAGE'),
        dataIndex: 'gpuUtil',
        width: 100,
        sort_metric: 'node_gpu_utilisation',
        render: (_, row) => this.toPercentValue(row.gpuUtil),
      },
      {
        title: t('GPU_ALLOCATION_COUNT'),
        dataIndex: 'gpuAllocated',
        width: 120,
        sort_metric: 'node_gpu_allocated',
        render: (_, row) =>
          row.gpuAllocated != null
            ? `${Number(row.gpuAllocated).toFixed(2)} ${t('GPU_CARD_UNIT')}`
            : '-',
      },
    ]
    return baseColumns.map(col => ({
      ...col,
      className: col.sort_metric === sortMetric ? styles.rankCol : '',
    }))
  }

  render() {
    const {
      data,
      total,
      page,
      limit,
      sortMetric,
      sortType,
      loading,
    } = this.state
    const totalPage = Math.max(1, Math.ceil(total / limit))

    return (
      <div className={styles.wrapper}>
        <h3 className={classNames(styles.pane, styles.title)}>
          {t('RESOURCE_USAGE_RANKING')}
        </h3>
        <div
          className={classNames(
            styles.toolbar,
            styles.pane__toolbar,
            styles.pane
          )}
        >
          <div className={styles.toolbar_filter}>
            <Select
              value={sortMetric}
              onChange={this.changeSortMetric}
              options={SORT_OPTIONS.map(opt => ({
                value: opt,
                label: t(`SORT_BY_${opt.toUpperCase()}`),
              }))}
            />
            <span className={styles.sort_button} onClick={this.changeSortType}>
              <Icon
                name={
                  sortType === 'desc' ? 'sort-descending' : 'sort-ascending'
                }
                type="coloured"
                size="small"
              />
            </span>
          </div>
          <div className={styles.toolbar_buttons}>
            <Button onClick={this.download}>{t('EXPORT')}</Button>
          </div>
        </div>
        <Loading spinning={loading}>
          <div>
            <div
              className={classNames(
                styles.table,
                styles.table_rank,
                styles.table_no_border
              )}
            >
              <Table
                dataSource={data}
                columns={this.columns}
                rowKey="uuid"
                emptyText={<Empty desc={t('NO_DATA')} />}
              />
            </div>
            <div className={classNames(styles.pane, styles.pane__pagination)}>
              <Level>
                <LevelLeft />
                <LevelRight>
                  <Pagination
                    page={page}
                    total={totalPage}
                    limit={limit}
                    onChange={this.changePage}
                  />
                </LevelRight>
              </Level>
            </div>
          </div>
        </Loading>
      </div>
    )
  }
}

export default withRouter(GPURanking)
