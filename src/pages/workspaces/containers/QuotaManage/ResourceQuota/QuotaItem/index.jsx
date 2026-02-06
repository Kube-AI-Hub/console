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
import { get, isUndefined } from 'lodash'
import { Icon } from '@kube-design/components'
import { Bar } from 'components/Base'

import { cpuFormat, memoryFormat } from 'utils'
import { ICON_TYPES } from 'utils/constants'

import * as styles from './index.scss'

const RESERVED_KEYS = [
  'limits.cpu',
  'limits.memory',
  'pods',
  'gpu',
  'gpu.memory',
]
const Unit = {
  Ti: 1024 ** 4,
  Gi: 1024 ** 3,
  Mi: 1024 ** 2,
  Ki: 1024,
  TB: 1000 ** 4,
  GB: 1000 ** 3,
  MB: 1000 ** 2,
  KB: 1000,
  T: 1000 ** 4,
  G: 1000 ** 3,
  M: 1000 ** 2,
  K: 1000,
  k: 1000,
  Bytes: 1,
  B: 1,
}

const QuotaItem = ({ name, total, used }) => {
  const isReserved =
    RESERVED_KEYS.indexOf(name) !== -1 || (name && name.includes('/'))
  if (!total && !Number(used) && !isReserved) {
    return null
  }

  let ratio = 0
  let usedUnit = ''
  let totalUnit = ''

  const getNumberUnit = value => {
    if (!value) return 0
    const matchUnit = /[0-9]+([a-zA-Z]+)/
    const unitsMaps = Object.keys(Unit)
    let _unit = get(value.match(matchUnit), '1', '')

    unitsMaps.forEach(unit => {
      if (_unit.indexOf(unit) > -1) {
        _unit = unit
        return false
      }
    })
    return _unit
  }

  const getNumberValue = (unit, value) =>
    unit
      ? [
          unit,
          parseFloat(value) *
            (ICON_TYPES[name] || !Unit[unit] ? 1 : Unit[unit]),
        ]
      : ['', parseFloat(value)]

  const handleNumberValue = value => getNumberValue(getNumberUnit(value), value)

  const handleUsedValue = usedValue => {
    if (name === 'gpu.memory') {
      return `${usedValue / 1024} Gi`
    }
    if (totalUnit && !usedUnit) {
      const unitValue =
        ICON_TYPES[name] || !Unit[totalUnit] ? 1 : Unit[totalUnit]
      return `${usedValue / unitValue}${usedValue > 0 ? totalUnit : ''}`
    }

    return usedValue
  }

  const getTranslationKey = (rawName = '') => {
    if (!rawName) return ''
    if (rawName.includes('/')) {
      const key = rawName
        .replace(/^(limits|requests)\./, '')
        .replace(/[./]/g, '_')
        .toUpperCase()
      return key || rawName.replace(/[. ]/g, '_').toUpperCase()
    }
    const key = rawName.replace(/[. ]/g, '_').toUpperCase()
    if (key === 'GPU' || key === 'LIMITS_GPU' || key === 'REQUESTS_GPU') {
      return 'GPU_LIMIT'
    }
    return key
  }

  const transformName = (text = '') => {
    if (ICON_TYPES[labelName]) {
      return t(getTranslationKey(text))
    }
    if (text && text.includes('/')) {
      return t(getTranslationKey(text))
    }
    return text
  }

  if (name === 'limits.cpu' || name === 'requests.cpu') {
    if (total) {
      ratio = Number(cpuFormat(used)) / Number(cpuFormat(total))
      used = `${cpuFormat(used)} Core`
      total = `${cpuFormat(total)} Core`
    }
  } else if (name === 'limits.memory' || name === 'requests.memory') {
    if (total) {
      ratio = Number(memoryFormat(used)) / Number(memoryFormat(total))
      used = `${memoryFormat(used, 'Gi')} Gi`
      total = `${memoryFormat(total, 'Gi')} Gi`
    }
  } else if (name === 'gpu.memory') {
    const [_totalUnit, _total] = handleNumberValue(total)
    totalUnit = _totalUnit
    ratio = used / 1024 / _total
  } else if (total) {
    const [_usedUnit, _used] = handleNumberValue(used)
    const [_totalUnit, _total] = handleNumberValue(total)

    usedUnit = _usedUnit
    totalUnit = _totalUnit

    ratio = _used / _total
  }

  ratio = Math.min(Math.max(ratio, 0), 1)
  const labelName =
    name.indexOf('gpu.limit') > -1 || name.includes('/') ? 'gpu' : name
  const labelText =
    labelName === 'gpu' && !name.includes('/') ? 'gpu.limit' : name
  return (
    <div className={styles.quota}>
      <Icon name={ICON_TYPES[labelName] || 'resource'} size={40} />
      <div className={styles.item}>
        <div>{transformName(labelText)}</div>
        <p>{t('RESOURCE_TYPE_SCAP')}</p>
      </div>
      <div className={styles.item}>
        <div>{handleUsedValue(used)}</div>
        <p>{t('USED')}</p>
      </div>
      <div className={styles.item}>
        <div>{isUndefined(total) ? t('NO_LIMIT') : total}</div>
        <p>{t('RESOURCE_LIMIT')}</p>
      </div>
      <div className={styles.item} style={{ flex: 3 }}>
        <div>{t('USAGE')}</div>
        <Bar
          value={Math.min(ratio, 1)}
          className={styles.bar}
          rightText={!total ? t('NO_LIMIT') : ''}
          text={t('USED_PERCENT', {
            percent: Number((ratio * 100).toFixed(2)),
          })}
        />
      </div>
    </div>
  )
}

export default QuotaItem
