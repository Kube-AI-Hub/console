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
import { getGpuTypeOptions, filterGpuTypeOptionsByCluster } from 'utils'
import { fetchClusterResourceSummary } from 'utils/cluster.resource.summary'

import GpuQuotaItem from './Item'

import * as styles from './index.scss'

export default class GpuQuotas extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      items: this.getItemsFromData(props.data),
      availableGpuResourceNames: undefined,
    }
  }

  componentDidMount() {
    this.fetchAvailableGpuResources()
  }

  componentDidUpdate(prevProps) {
    if (prevProps.data !== this.props.data) {
      this.setState({
        items: this.getItemsFromData(this.props.data),
      })
    }

    if (prevProps.cluster !== this.props.cluster) {
      this.fetchAvailableGpuResources()
    }
  }

  /** 项目配额弹窗会传入集群，用于过滤集群里没有的显卡类型；无集群时退回全局列表 */
  async fetchAvailableGpuResources() {
    const { cluster } = this.props
    if (!cluster) {
      return
    }
    try {
      const summary = await fetchClusterResourceSummary(cluster)
      this.setState({
        availableGpuResourceNames:
          (summary && summary.availableGpuResourceNames) || [],
      })
    } catch (e) {
      this.setState({ availableGpuResourceNames: undefined })
    }
  }

  get supportGpuType() {
    return globals.config.supportGpuType || []
  }

  get selectedGpuTypes() {
    // 只把平台已知的资源名当成"已选类型"保留；搜索时输入的临时文本不应变成选项
    const support = this.supportGpuType
    return this.state.items
      .map(item => item.type)
      .filter(type => type && support.includes(type))
  }

  get gpuTypeOptions() {
    return (
      filterGpuTypeOptionsByCluster(
        this.state.availableGpuResourceNames,
        this.selectedGpuTypes
      ) || getGpuTypeOptions()
    )
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
    const validItems = items.filter(({ type }) => this.isValidGpuType(type))

    if (this.dataMode === 'defaultResource') {
      const defaultObj = get(data, 'default', {})
      const defaultRequestObj = get(data, 'defaultRequest', {})
      const newDefault = omitBy(defaultObj, (_, key) =>
        this.supportGpuType.includes(key)
      )
      const newDefaultRequest = omitBy(defaultRequestObj, (_, key) =>
        this.supportGpuType.includes(key)
      )
      validItems.forEach(({ type, quota }) => {
        if (quota !== undefined && quota !== '' && Number(quota) >= 0) {
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
    validItems.forEach(({ type, quota }) => {
      if (quota !== undefined && quota !== '' && Number(quota) >= 0) {
        newHard[`requests.${type}`] = String(quota)
      }
    })
    set(data, hardPath, newHard)
  }

  handleChange = items => {
    this.setState({ items }, () => {
      this.syncToData(items)
      if (this.props.onChange) {
        this.props.onChange()
      }
    })
  }

  /** 只有平台已知的显卡资源名才是合法类型，避免把输入中的临时文本写进配额 */
  isValidGpuType = type => !!type && this.supportGpuType.includes(type)

  checkItemValid = item => {
    if (!item || isEmpty(item)) return true
    return (
      this.isValidGpuType(item.type) &&
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
            <GpuQuotaItem options={this.gpuTypeOptions} />
          </ArrayInput>
        </Form.Item>
      </div>
    )
  }
}
