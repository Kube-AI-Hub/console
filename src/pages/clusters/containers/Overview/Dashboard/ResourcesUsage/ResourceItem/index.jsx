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

import { Text } from 'components/Base'

import { getSuitableUnit, getValueByUnit } from 'utils/monitoring'

import * as styles from './index.scss'

export default function ResourceItem(props) {
  const title = t(props.name)
  const unit = getSuitableUnit(props.total, props.unitType) || unit
  const used = getValueByUnit(props.used, unit)
  const total = getValueByUnit(props.total, unit) || used
  const allocated = props.allocated
    ? getValueByUnit(props.allocated, unit)
    : null

  const formatValue = (value) => {
    if (!unit) return value
    // GPU 单位显示为"卡"
    if (props.unitType === 'gpu') {
      return `${value} ${t('GPU_CARD_UNIT')}`
    }
    // CPU 单位显示为"核"
    if (unit === 'core') {
      return `${value} ${t('CORE_PL')}`
    }
    return value !== 1 && unit === 'core' ? `${value} cores` : `${value} ${unit}`
  }

  return (
    <div className={styles.item}>
      <Text
        title={`${Math.round((used * 100) / total)}%`}
        description={title}
      />
      <div className={styles.usedAllocated}>
        <div className={styles.usedRow}>
          <span className={styles.usedLabel}>{t('USED')}:</span>
          <span className={styles.usedValue}>{formatValue(used)}</span>
        </div>
        {allocated !== null && (
          <div className={styles.allocatedRow}>
            <span className={styles.allocatedLabel}>{t('ALLOCATED')}:</span>
            <span className={styles.allocatedValue}>{formatValue(allocated)}</span>
          </div>
        )}
      </div>
      <Text
        title={formatValue(total)}
        description={t('TOTAL')}
      />
    </div>
  )
}
