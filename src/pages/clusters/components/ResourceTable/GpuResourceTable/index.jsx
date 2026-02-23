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

import withTableActions from 'components/HOCs/withTableActions'

import BaseTable from 'components/Tables/Base'
import { isEmpty } from 'lodash'
import { inject, observer } from 'mobx-react'
import React from 'react'
import NodeStore from 'stores/node'
import NodeSelect from '../NodeSelect'

class GpuResourceTable extends React.Component {
  nodeStore = new NodeStore()

  componentDidMount() {
    const { cluster } = this.props
    if (cluster) {
      this.nodeStore.fetchList({ cluster, type: 'node', limit: -1 })
    }
  }

  componentDidUpdate(prevProps) {
    const { cluster } = this.props
    if (cluster && cluster !== prevProps.cluster) {
      this.nodeStore.fetchList({ cluster, type: 'node', limit: -1 })
    }
  }

  get showEmpty() {
    const { data, isLoading, filters } = this.props
    return isEmpty(data) && !isLoading && isEmpty(filters)
  }

  fetchNodes = (params = {}) => {
    const { cluster } = this.props
    return this.nodeStore.fetchList({
      cluster,
      type: 'node',
      limit: -1,
      ...params,
    })
  }

  handleNodeChange = nodeName => {
    const { filters, onFetch } = this.props
    const newFilters = { ...filters }
    if (nodeName) {
      newFilters.nodeName = nodeName
    } else {
      delete newFilters.nodeName
    }
    onFetch(newFilters, true)
  }

  renderCustomFilter() {
    const { cluster, filters } = this.props
    return (
      <NodeSelect
        cluster={cluster}
        value={filters?.nodeName ?? ''}
        list={this.nodeStore.list}
        onFetch={this.fetchNodes}
        onChange={this.handleNodeChange}
      />
    )
  }

  render() {
    return (
      <BaseTable
        customFilter={this.renderCustomFilter()}
        showEmpty={this.showEmpty}
        {...this.props}
      />
    )
  }
}

export default inject('rootStore')(withTableActions(observer(GpuResourceTable)))
