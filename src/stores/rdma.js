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

const RDMA_API = '/kapis/rdma.kubesphere.io/v1alpha1/ports'

export default class RdmaStore extends Base {
  module = 'rdmaPorts'

  getListUrl = () => RDMA_API

  @action
  async fetchList({
    cluster,
    limit = -1,
    page = 1,
    sortBy = 'nodeName',
    ascending = true,
    nodeName,
    device,
    state,
    health,
    ...rest
  } = {}) {
    const params = { limit, page, sortBy, ascending }
    if (nodeName) params.nodeName = nodeName
    if (device) params.device = device
    if (state) params.state = state
    if (health) params.health = health

    Object.keys(rest).forEach(key => {
      if (
        rest[key] &&
        !['cluster', 'workspace', 'namespace', 'more', 'silent'].includes(key)
      ) {
        params[key] = rest[key]
      }
    })

    try {
      const result = await request.get(RDMA_API, params)
      const items = get(result, 'items', [])
      const totalItems = get(result, 'totalItems', items.length)
      this.list.update({
        data: items.map(item => ({
          ...item,
          cluster,
          _rowKey: `${item.nodeName || ''}-${item.device || ''}-${item.port ||
            ''}`,
        })),
        total: totalItems,
        page,
        limit: limit === -1 ? totalItems : limit,
        sortBy: params.sortBy,
        ascending: params.ascending,
        isLoading: false,
      })
      // this.list.data is a mobx ObservableArray, and Array.isArray() is false
      // for those. Callers use the return value directly (the overview card
      // checks it before setState), so hand back a plain array.
      return Array.from(this.list.data)
    } catch (e) {
      this.list.update({
        data: [],
        total: 0,
        page: 1,
        limit,
        isLoading: false,
      })
      return []
    }
  }
}
