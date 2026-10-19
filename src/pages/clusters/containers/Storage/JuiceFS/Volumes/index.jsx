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

import {
  Button,
  Loading,
  Table,
  Level,
  LevelLeft,
  LevelRight,
} from '@kube-design/components'
import { Card } from 'components/Base'
import Empty from 'components/Base/Empty'
import QuotaModal from './QuotaModal'

import { formatBytes, usagePercent, usageLevel } from '../utils'

import * as styles from './index.scss'

/**
 * Volume list with the one write action of the page: setting a quota.
 *
 * The quota shown is the PV's capacity, i.e. what the CSI driver writes into the
 * JuiceFS directory quota on every mount. The statfs number kubelet reports can
 * lag a change, which the row says instead of pretending they agree.
 *
 * Columns are built with the Table's `render` callback (the component reads
 * `column.render`, not a per-table renderCell).
 */
@inject('rootStore')
@observer
export default class SharedVolumes extends React.Component {
  state = {
    quotaTarget: null,
    submitting: false,
    error: '',
  }

  get store() {
    return this.props.rootStore.juicefs
  }

  componentDidMount() {
    this.store.fetchVolumes()
  }

  openQuota = volume => {
    this.setState({ quotaTarget: volume, error: '' })
  }

  closeQuota = () => {
    if (this.state.submitting) return
    this.setState({ quotaTarget: null, error: '' })
  }

  submitQuota = async capacity => {
    const { quotaTarget } = this.state
    if (!quotaTarget) return

    this.setState({ submitting: true, error: '' })
    try {
      await this.store.setQuota(quotaTarget.name, capacity)
      this.setState({ submitting: false, quotaTarget: null })
    } catch (error) {
      // The apiserver rolls the PV back when the job fails, so the message here is
      // the CLI's own reason (e.g. a capacity the CLI rejected).
      this.setState({ submitting: false, error: get(error, 'message', '') })
    }
  }

  renderVolume = (_, volume) => (
    <div>
      <div className={styles.mono} data-volume={volume.name}>
        {volume.name}
      </div>
      <div className={styles.muted}>
        {volume.claimNamespace}/{volume.claimName}
      </div>
    </div>
  )

  renderDirectory = (_, volume) => (
    <div>
      <span className={styles.mono}>{volume.path}</span>
      {volume.parent ? (
        <div className={styles.muted}>
          {t('SHARED_STORAGE_NESTED_IN', { parent: volume.parent })}
        </div>
      ) : null}
    </div>
  )

  renderCapacity = (_, volume) => (
    <div className={styles.capacityCell}>
      <span data-bytes={volume.capacityBytes}>{formatBytes(volume.capacityBytes)}</span>
      {volume.quotaDrift ? (
        <span className={styles.drift} title={t('SHARED_STORAGE_QUOTA_DRIFT')}>
          {t('SHARED_STORAGE_QUOTA_DRIFT')}
        </span>
      ) : null}
    </div>
  )

  renderUsed = (_, volume) => (
    <span data-bytes={volume.usedBytes}>{formatBytes(volume.usedBytes)}</span>
  )

  renderUsage = (_, volume) => {
    const percent = usagePercent(volume.usedBytes, volume.capacityBytes)
    return (
      <div className={styles.usageCell}>
        <div className={styles.usageBar}>
          <div
            className={styles.usageBarFill}
            data-level={usageLevel(percent)}
            style={{ width: `${Math.max(percent, 1)}%` }}
          />
        </div>
        <span className={styles.usagePercent}>{percent.toFixed(1)}%</span>
      </div>
    )
  }

  renderInodes = (_, volume) =>
    volume.inodes > 0 ? (
      <span className={styles.muted}>
        {volume.inodesUsed} / {volume.inodes}
      </span>
    ) : (
      <span className={styles.muted}>{t('SHARED_STORAGE_UNKNOWN')}</span>
    )

  renderNodes = (_, volume) =>
    volume.mountedNodes && volume.mountedNodes.length ? (
      <span className={styles.muted}>{volume.mountedNodes.join(', ')}</span>
    ) : (
      <span className={styles.muted}>{t('SHARED_STORAGE_NOT_MOUNTED')}</span>
    )

  get columns() {
    return [
      {
        title: t('SHARED_STORAGE_VOLUME'),
        key: 'name',
        render: this.renderVolume,
      },
      {
        title: t('SHARED_STORAGE_DIRECTORY'),
        key: 'path',
        render: this.renderDirectory,
      },
      {
        title: t('SHARED_STORAGE_CAPACITY'),
        key: 'capacity',
        render: this.renderCapacity,
      },
      {
        title: t('SHARED_STORAGE_USED'),
        key: 'used',
        render: this.renderUsed,
      },
      {
        title: t('SHARED_STORAGE_USAGE'),
        key: 'usage',
        render: this.renderUsage,
      },
      {
        title: t('SHARED_STORAGE_INODES'),
        key: 'inodes',
        render: this.renderInodes,
      },
      {
        title: t('SHARED_STORAGE_NODES'),
        key: 'nodes',
        render: this.renderNodes,
      },
      {
        title: '',
        key: 'actions',
        render: (_, volume) => (
          <Button
            type="control"
            onClick={() => this.openQuota(volume)}
            disabled={volume.capacityBytes <= 0}
          >
            {t('SHARED_STORAGE_SET_QUOTA')}
          </Button>
        ),
      },
    ]
  }

  renderTable() {
    const { volumes, volumesLoading } = this.store

    if (!volumesLoading && !volumes.length) {
      return <Empty />
    }

    return (
      <Loading spinning={volumesLoading}>
        <Table
          columns={this.columns}
          dataSource={volumes}
          rowKey="name"
          emptyText={t('SHARED_STORAGE_NO_VOLUMES')}
        />
      </Loading>
    )
  }

  render() {
    const { quotaTarget, submitting, error } = this.state

    return (
      <div>
        <Card title={t('SHARED_STORAGE_VOLUMES')}>
          <Level>
            <LevelLeft>
              <span className={styles.muted}>
                {t('SHARED_STORAGE_VOLUMES_HINT')}
              </span>
            </LevelLeft>
            <LevelRight>
              <Button onClick={() => this.store.fetchVolumes()}>
                {t('REFRESH')}
              </Button>
            </LevelRight>
          </Level>
          {this.renderTable()}
        </Card>

        {quotaTarget ? (
          <QuotaModal
            volume={quotaTarget}
            visible
            submitting={submitting}
            error={error}
            onOk={this.submitQuota}
            onCancel={this.closeQuota}
          />
        ) : null}
      </div>
    )
  }
}
