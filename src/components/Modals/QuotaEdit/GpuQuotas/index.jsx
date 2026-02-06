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
import { get, set, omitBy, isEmpty } from 'lodash'
import { Form } from '@kube-design/components'

import { ArrayInput } from 'components/Inputs'

import GpuQuotaItem from './Item'

import * as styles from './index.scss'

export default class GpuQuotas extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      items: this.getItemsFromData(props.data),
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.data !== this.props.data) {
      this.setState({
        items: this.getItemsFromData(this.props.data),
      })
    }
  }

  get supportGpuType() {
    return globals.config.supportGpuType || []
  }

  get dataMode() {
    return this.props.dataMode || 'projectQuota'
  }

  getHardPath() {
    return this.dataMode === 'workspaceQuota' ? 'spec.quota.hard' : 'spec.hard'
  }

  getItemsFromData(data) {
    if (this.dataMode === 'defaultResource') {
      const defaultLimits = get(data, 'default', {})
      const items = []
      this.supportGpuType.forEach(type => {
        const value = defaultLimits[type]
        if (value !== undefined && value !== null && value !== '') {
          items.push({ type, quota: String(value) })
        }
      })
      if (items.length === 0) return [{}]
      return items
    }

    const hard = get(data, this.getHardPath(), {})
    const items = []
    this.supportGpuType.forEach(type => {
      const key = `requests.${type}`
      const value = hard[key]
      if (value !== undefined && value !== null && value !== '') {
        items.push({ type, quota: String(value) })
      }
    })
    if (items.length === 0) return [{}]
    return items
  }

  syncToData = items => {
    const { data } = this.props

    if (this.dataMode === 'defaultResource') {
      const defaultObj = get(data, 'default', {})
      const defaultRequestObj = get(data, 'defaultRequest', {})
      const newDefault = omitBy(defaultObj, (_, key) =>
        this.supportGpuType.includes(key)
      )
      const newDefaultRequest = omitBy(defaultRequestObj, (_, key) =>
        this.supportGpuType.includes(key)
      )
      items.forEach(({ type, quota }) => {
        if (type && quota !== undefined && quota !== '' && Number(quota) >= 0) {
          newDefault[type] = String(quota)
          newDefaultRequest[type] = String(quota)
        }
      })
      set(data, 'default', newDefault)
      set(data, 'defaultRequest', newDefaultRequest)
      return
    }

    const hardPath = this.getHardPath()
    const hard = get(data, hardPath, {})
    const newHard = omitBy(hard, (_, key) =>
      this.supportGpuType.some(
        type => key === `requests.${type}` || key === `limits.${type}`
      )
    )
    items.forEach(({ type, quota }) => {
      if (type && quota !== undefined && quota !== '' && Number(quota) >= 0) {
        newHard[`requests.${type}`] = String(quota)
      }
    })
    set(data, hardPath, newHard)
  }

  handleChange = items => {
    this.setState({ items }, () => {
      this.syncToData(items)
    })
  }

  checkItemValid = item => {
    if (!item || isEmpty(item)) return true
    return (
      item.type &&
      item.quota !== undefined &&
      item.quota !== '' &&
      Number(item.quota) >= 0
    )
  }

  render() {
    const { items } = this.state

    if (this.supportGpuType.length === 0) {
      return null
    }

    return (
      <div className={styles.wrapper}>
        <Form.Item>
          <ArrayInput
            value={items}
            itemType="object"
            addText={t('ADD')}
            onChange={this.handleChange}
            checkItemValid={this.checkItemValid}
          >
            <GpuQuotaItem />
          </ArrayInput>
        </Form.Item>
      </div>
    )
  }
}
