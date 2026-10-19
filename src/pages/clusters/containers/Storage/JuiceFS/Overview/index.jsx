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

import { Columns, Column, Loading } from '@kube-design/components'
import { Card } from 'components/Base'
import Empty from 'components/Base/Empty'
import { SimpleBar } from 'components/Charts'

import { formatBytes, usagePercent, usageLevel } from '../utils'

import * as styles from './index.scss'

/**
 * Overview: the one screen that answers "is the shared storage healthy".
 *
 * Totals first, then the fullest volumes, then the two things that silently make
 * the numbers wrong: a quota the client has not caught up with, and metrics being
 * off (the performance tab then has nothing to show).
 */
@inject('rootStore')
@observer
export default class SharedOverview extends React.Component {
  get store() {
    return this.props.rootStore.juicefs
  }

  componentDidMount() {
    this.store.fetchSummary()
    this.store.fetchVolumes()
  }

  get cards() {
    const { summary = {}, volumes = [] } = this.store
    const capacity = get(summary, 'capacityBytes', 0)
    const used = get(summary, 'usedBytes', 0)
    const percent = usagePercent(used, capacity)

    return [
      {
        key: 'volumes',
        title: t('SHARED_STORAGE_VOLUME_COUNT'),
        value: get(summary, 'volumeCount', volumes.length),
        unit: '',
      },
      {
        key: 'capacity',
        title: t('SHARED_STORAGE_TOTAL_CAPACITY'),
        value: formatBytes(capacity),
        unit: '',
        valueBytes: capacity,
      },
      {
        key: 'used',
        title: t('SHARED_STORAGE_TOTAL_USED'),
        value: formatBytes(used),
        unit: `${percent.toFixed(1)}%`,
        // Kept apart from the value so the two are not read as one number, and
        // carrying the exact byte count because the visible value is rounded.
        valueTestId: 'shared-storage-total-used',
        unitTestId: 'shared-storage-total-used-percent',
        valueBytes: used,
      },
      {
        key: 'fullest',
        title: t('SHARED_STORAGE_FULLEST_VOLUME'),
        value: `${(get(summary, 'maxUsageRatio', 0) * 100).toFixed(1)}%`,
        unit: '',
      },
    ]
  }

  renderCards() {
    return (
      <Columns className="is-4">
        {this.cards.map(card => (
          <Column key={card.key}>
            <Card className={styles.card}>
              <div className={styles.cardTitle}>{card.title}</div>
              <div
                className={styles.cardValue}
                data-test={card.valueTestId}
                data-bytes={card.valueBytes}
              >
                {card.value}
                {card.unit ? (
                  <span
                    className={styles.cardUnit}
                    data-test={card.unitTestId}
                  >
                    {card.unit}
                  </span>
                ) : null}
              </div>
            </Card>
          </Column>
        ))}
      </Columns>
    )
  }

  renderUsage() {
    const volumes = [...this.store.volumes].sort(
      (a, b) =>
        usagePercent(b.usedBytes, b.capacityBytes) -
        usagePercent(a.usedBytes, a.capacityBytes)
    )

    if (!volumes.length) {
      return <Empty />
    }

    return (
      <div className={styles.usageList}>
        {volumes.map(volume => {
          const percent = usagePercent(volume.usedBytes, volume.capacityBytes)
          return (
            <div key={volume.name} className={styles.usageRow}>
              <div className={styles.usageName}>
                <span className={styles.mono}>{volume.path}</span>
                <span className={styles.usageClaim}>
                  {volume.claimNamespace}/{volume.claimName}
                </span>
              </div>
              <div className={styles.usageBar}>
                <div
                  className={styles.usageBarFill}
                  data-level={usageLevel(percent)}
                  style={{ width: `${Math.max(percent, 1)}%` }}
                />
              </div>
              <div className={styles.usageValue}>
                {formatBytes(volume.usedBytes)} /{' '}
                {formatBytes(volume.capacityBytes)}
                <span className={styles.usagePercent}>
                  {percent.toFixed(1)}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  renderHints() {
    const { volumes = [], summary = {} } = this.store
    const hints = []

    const drifting = volumes.filter(v => v.quotaDrift)
    if (drifting.length) {
      hints.push({
        key: 'drift',
        level: 'warning',
        text: t('SHARED_STORAGE_QUOTA_DRIFT_HINT', {
          volumes: drifting.map(v => v.path).join(', '),
        }),
      })
    }

    const nested = volumes.filter(v => v.parent)
    if (nested.length) {
      hints.push({
        key: 'nested',
        level: 'info',
        text: t('SHARED_STORAGE_NESTED_HINT'),
      })
    }

    if (!get(summary, 'metricsEnabled', false)) {
      hints.push({
        key: 'metrics',
        level: 'info',
        text: t('SHARED_STORAGE_METRICS_OFF_HINT'),
      })
    }

    if (!hints.length) return null

    return (
      <div className={styles.hints}>
        {hints.map(hint => (
          <div key={hint.key} className={styles.hint} data-level={hint.level}>
            {hint.text}
          </div>
        ))}
      </div>
    )
  }

  render() {
    const { summaryLoading, volumesLoading } = this.store

    return (
      <Loading spinning={summaryLoading || volumesLoading}>
        <div>
          {this.renderCards()}
          {this.renderHints()}
          <div className={styles.section}>
            <Card title={t('SHARED_STORAGE_USAGE_BY_VOLUME')}>
              {this.renderUsage()}
            </Card>
          </div>
        </div>
      </Loading>
    )
  }
}
