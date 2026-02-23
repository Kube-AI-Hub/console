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

import { action } from 'mobx'
import { get } from 'lodash'

import Base from './base'

const GPU_API = '/kapis/gpu.kubesphere.io/v1alpha1/gpus'

export default class GpuStore extends Base {
  module = 'gpus'

  getListUrl = () => GPU_API

  @action
  async fetchList({
    cluster,
    limit = 10,
    page = 1,
    sortBy = 'nodeName',
    ascending = true,
    labelSelector,
    nodeName,
    uuid,
    deviceVendor,
    type,
    status,
    ...rest
  } = {}) {
    this.list.isLoading = true

    if (limit === Infinity || limit === -1) {
      limit = -1
      page = 1
    }

    const params = {
      limit,
      page,
      sortBy: sortBy || 'nodeName',
      ascending,
    }
    if (labelSelector) params.labelSelector = labelSelector
    if (nodeName) params.nodeName = nodeName
    if (uuid) params.uuid = uuid
    if (deviceVendor) params.deviceVendor = deviceVendor
    if (type) params.type = type
    if (status) params.status = status

    Object.keys(rest).forEach(key => {
      if (
        rest[key] &&
        ![
          'cluster',
          'workspace',
          'namespace',
          'more',
          'devops',
          'silent',
        ].includes(key)
      ) {
        params[key] = rest[key]
      }
    })

    try {
      const result = await request.get(GPU_API, params)
      const items = get(result, 'items', [])
      const totalItems = get(result, 'totalItems', items.length)

      const data = items.map(item => ({
        ...item,
        cluster,
        _rowKey: `${item.nodeName || ''}-${item.uuid || ''}`,
      }))

      const filters = {}
      if (labelSelector) filters.labelSelector = labelSelector
      if (nodeName) filters.nodeName = nodeName
      if (uuid) filters.uuid = uuid
      if (deviceVendor) filters.deviceVendor = deviceVendor
      if (type) filters.type = type
      if (status) filters.status = status

      this.list.update({
        data,
        total: totalItems,
        page,
        limit: limit === -1 ? totalItems : limit,
        sortBy: params.sortBy,
        ascending: params.ascending,
        filters,
        isLoading: false,
      })
    } catch (err) {
      this.list.update({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        isLoading: false,
      })
    }
  }
}
