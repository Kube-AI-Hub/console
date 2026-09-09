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
import classnames from 'classnames'
import { get, isEmpty, isUndefined } from 'lodash'

import * as styles from './index.scss'
import {
  METER_COMPUTE_TYPES,
  METER_NETWORK_TYPES,
  METER_RESOURCE_TITLE,
} from '../../constats'

const resourceTitleKey = key => {
  const title = METER_RESOURCE_TITLE[key]
  if (!title) {
    return key
  }
  return title.toUpperCase().replace(/\s+/g, '_')
}

const MeterDetailCard = ({
  className,
  title,
  isParent,
  priceConfig,
  ...meterData
} = {}) => {
  const priceUnit = priceConfig.currency ? priceConfig.currency : ' '

  const handleSumFeeData = () => {
    const feeData = meterData.feeData
    let total = 0

    if (!isUndefined(feeData) && !isEmpty(feeData)) {
      total =
        Object.keys(feeData)
          .map(key => parseFloat(get(feeData[key], 'value', 0)) * 100)
          .reduce((pev, current) => {
            return pev + current
          }, 0) / 100
    }

    return total.toFixed(2)
  }

  const handleFixed = value => {
    const result = handleValue(value)
    return result !== '-' ? result.toFixed(3) : result
  }

  const handleValue = value => {
    return isUndefined(value) ? '-' : value < 0 ? 0 : value
  }

  const orderedKeys = data => {
    const preferred = [...METER_COMPUTE_TYPES, ...METER_NETWORK_TYPES]
    const keys = Object.keys(data || {}).filter(
      key => key.indexOf('by_model') === -1
    )
    const rest = keys.filter(key => !preferred.includes(key))
    return [...preferred.filter(key => keys.includes(key)), ...rest]
  }

  const renderItems = (data, type, keys) => {
    return keys.map(key => {
      if (!data[key]) {
        return null
      }
      const dataValue = get(data[key], 'value')
      const value =
        type === 'meter' ? handleFixed(dataValue) : handleValue(dataValue)

      return (
        <li key={key}>
          <div>{value}</div>
          <p>
            <span>{t(resourceTitleKey(key))}</span>
            <span>({get(data[key], 'unit.label', '-')})</span>
          </p>
        </li>
      )
    })
  }

  const renderGroupedList = (data, type) => {
    if (isEmpty(data)) {
      return null
    }

    if (type === 'price' && isEmpty(priceConfig)) {
      return (
        <ul className={styles.noPriceTip}>
          <li>{t('PRICE_CONFIG_DESC')}</li>
        </ul>
      )
    }

    const keys = orderedKeys(data)
    const computeKeys = keys.filter(key => METER_COMPUTE_TYPES.includes(key))
    const otherKeys = keys.filter(key => !METER_COMPUTE_TYPES.includes(key))

    return (
      <div className={styles.groupWrap}>
        {computeKeys.length > 0 && (
          <div className={styles.group}>
            <h5>{t('COMPUTE_RESOURCE')}</h5>
            <ul>{renderItems(data, type, computeKeys)}</ul>
          </div>
        )}
        {otherKeys.length > 0 && (
          <div className={styles.group}>
            <h5>{t('STORAGE_AND_NETWORK')}</h5>
            <ul>{renderItems(data, type, otherKeys)}</ul>
          </div>
        )}
      </div>
    )
  }

  const renderCurrentTotal = _title => {
    const feeTotal = handleSumFeeData()

    return (
      <div>
        <h3>
          {_title} {t('CONSUMPTION_SINCE_CREATION')}
        </h3>
        {isEmpty(priceConfig) ? null : (
          <div className={styles.totalPrice}>
            <h4>{feeTotal}</h4>
            <p>{t('TOTAL_COST', { unit: priceUnit })}</p>
          </div>
        )}
      </div>
    )
  }

  const renderParentTotal = _title => {
    const feeTotal = handleSumFeeData()

    return (
      <div className={styles.parentCostContainer}>
        <div>
          <h3>{_title}</h3>
          <span> {t('CONSUMPTION_SINCE_CREATION')}</span>
        </div>
        <p>
          <span>{priceUnit}</span>
          {feeTotal}
        </p>
      </div>
    )
  }

  const { sumData = {}, feeData = {} } = meterData

  if (isParent) {
    return (
      <div className={classnames(styles.billTotal, className)}>
        {renderParentTotal(title)}
      </div>
    )
  }

  return (
    <div className={classnames(styles.billTotal, className)}>
      {renderCurrentTotal(title)}
      <div className={styles.consumContainer}>
        {isEmpty(sumData) && isEmpty(feeData) ? null : (
          <>
            {renderGroupedList(sumData, 'meter')}
            <div className={styles.line}></div>
            {renderGroupedList(feeData, 'price')}
          </>
        )}
      </div>
    </div>
  )
}

export default MeterDetailCard
