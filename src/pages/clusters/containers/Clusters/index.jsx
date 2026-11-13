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

import { isEmpty, sortBy } from 'lodash'
import React from 'react'
import { observer, inject } from 'mobx-react'
import { Button, Loading, Pagination } from '@kube-design/components'
import FilterInput from 'components/Tables/Base/FilterInput'
import Banner from 'components/Cards/Banner'
import EmptyList from 'components/Cards/EmptyList'
import ClusterCard from 'clusters/components/Cards/Cluster'
import ClusterStore from 'stores/cluster'
import { showNameAndAlias } from 'utils'
import { trigger } from 'utils/action'
import request from 'utils/request'

import EditBasicInfoModal from 'clusters/components/Modals/EditBasicInfo'
import * as styles from './index.scss'

const HOST_JWT_SECRET_COMMAND = [
  'kubectl -n kubesphere-system get cm kubesphere-config -o yaml',
  '| grep -v "apiVersion" | grep jwtSecret',
].join(' ')
const MEMBER_CLUSTER_CONFIG_COMMAND =
  'kubectl edit cc ks-installer -n kubesphere-system'

@inject('rootStore')
@observer
@trigger
class Clusters extends React.Component {
  constructor(props) {
    super(props)

    this.store = new ClusterStore()
    this.hostStore = new ClusterStore()
    this.state = {
      filters: {},
      jwtMismatchClusters: [],
    }
    this.jwtProbeSeq = 0
  }

  componentDidMount() {
    this.initData()
  }

  componentWillUnmount() {
    this.jwtProbeSeq = -1
  }

  get authKey() {
    return 'clusters'
  }

  get enabledActions() {
    return globals.app.getActions({
      module: this.authKey,
    })
  }

  get isOperation() {
    return this.enabledActions.includes('create')
  }

  get routing() {
    return this.props.rootStore.routing
  }

  initData = () => {
    this.fetchHostData()
    this.fetchData()
  }

  fetchData = (params = {}) => {
    this.store
      .fetchListByUser({
        ...params,
        limit: 10,
        labelSelector: '!cluster-role.kubesphere.io/host',
      })
      .then(data => this.probeProxyJwtSecret(data))
  }

  probeProxyJwtSecret = async clusters => {
    const seq = this.jwtProbeSeq + 1
    this.jwtProbeSeq = seq
    const proxyClusters = (clusters || []).filter(
      item => item.connectionType === 'proxy' && !item.isHost
    )
    const results = await Promise.all(
      proxyClusters.map(async item => {
        const mismatched = await this.clusterJwtSecretMismatched(item.name)
        return mismatched ? item : null
      })
    )
    if (this.jwtProbeSeq !== seq) {
      return
    }
    this.setState({
      jwtMismatchClusters: results.filter(Boolean),
    })
  }

  clusterJwtSecretMismatched = async name => {
    try {
      await request.get(
        `kapis/version/klusters/${name}/`,
        {},
        {},
        (first, second) => {
          const error = second && second.message ? second : first
          return Promise.reject(error)
        }
      )
      return false
    } catch (error) {
      const message = String((error && error.message) || '').toLowerCase()
      return message.includes('signature is invalid')
    }
  }

  fetchHostData = (params = {}) => {
    this.hostStore.fetchListByUser({
      ...params,
      labelSelector: 'cluster-role.kubesphere.io/host=',
      limit: -1,
    })
  }

  showAddCluster = () => {
    this.trigger('cluster.add', {
      module: 'clusters',
      success: this.routing.push,
    })
  }

  handlePagination = page => {
    this.fetchData({ page })
  }

  handleRefresh = () => {
    this.fetchData({ page: 1 })
  }

  handleSearch = params => {
    this.fetchData(params)
    this.fetchHostData(params)
  }

  enterCluster = async cluster => {
    this.routing.push(`/clusters/${cluster}/overview`)
  }

  getItemActions = item => {
    const actions = [
      {
        key: 'pen',
        icon: 'pen',
        text: t('EDIT_INFORMATION'),
        show: true,
        onClick: record => {
          this.trigger('resource.baseinfo.edit', {
            detail: record,
            modal: EditBasicInfoModal,
            success: this.initData,
          })
        },
      },
      {
        key: 'data',
        icon: 'data',
        text: t('UPDATE_KUBECONFIG'),
        show: !item.isHost && item.connectionType !== 'proxy',
        onClick: record => {
          this.trigger('cluster.updateKubeConfig', {
            detail: record,
            success: this.initData,
          })
        },
      },
      {
        key: 'trash',
        icon: 'trash',
        text: t('REMOVE_CLUSTER'),
        show: !item.isHost,
        onClick: record => {
          this.trigger('cluster.unbind', {
            detail: record,
            success: this.initData,
          })
        },
      },
    ]

    return actions.filter(action => action.show)
  }

  renderList() {
    const { data, page, total, limit, filters, isLoading } = this.store.list
    const {
      data: hostClusters,
      isLoading: isHostLoading,
      filters: hostFilters,
    } = this.hostStore.list

    if (
      isEmpty(data) &&
      !isLoading &&
      isEmpty(filters) &&
      !isHostLoading &&
      isEmpty(hostFilters) &&
      isEmpty(hostClusters)
    ) {
      return (
        <EmptyList
          icon="cluster"
          title={t('NO_CLUSTER_TIP')}
          desc={t('NO_CLUSTER_TIP_DESC')}
          actions={
            this.isOperation ? (
              <Button type="control" onClick={this.showAddCluster}>
                {t('ADD_CLUSTER')}
              </Button>
            ) : null
          }
        />
      )
    }

    if (isLoading || isHostLoading) {
      return <Loading className={styles.loading} />
    }

    if (
      !isLoading &&
      isEmpty(data) &&
      !isHostLoading &&
      isEmpty(hostClusters)
    ) {
      return (
        <>
          <div className="h6 margin-b12">
            {t('CLUSTER_PL')} <span className={styles.total}>{total}</span>
          </div>
          <div className={styles.noData}>
            <img src="/assets/empty-card.svg" alt="" />
            <p>{t('NO_RESOURCE_FOUND')}</p>
          </div>
        </>
      )
    }

    const _data = sortBy(data, item => item.expiredDay)

    return (
      <ul className={styles.cards}>
        {!isEmpty(hostClusters) && (
          <div className="margin-b12">
            <div className="h6">
              {hostClusters.length === 1
                ? t('HOST_CLUSTER_TCAP')
                : t('HOST_CLUSTER_PL_TCAP')}
            </div>
            {hostClusters.map(item => (
              <ClusterCard
                key={item.name}
                data={item}
                onEnter={this.enterCluster}
                isOperation={this.isOperation}
                itemActions={this.getItemActions(item)}
              />
            ))}
          </div>
        )}
        {!isEmpty(_data) && (
          <div>
            <div className="h6">
              {t('MEMBER_CLUSTER_TCAP_PL')}{' '}
              <span className={styles.total}>{total}</span>
            </div>
            {this.renderJwtMismatchHint()}
            {_data.map(item => (
              <ClusterCard
                key={item.name}
                data={item}
                onEnter={this.enterCluster}
                isOperation={this.isOperation}
                itemActions={this.getItemActions(item)}
                jwtSecretMismatch={this.state.jwtMismatchClusters.some(
                  cluster => cluster.name === item.name
                )}
              />
            ))}
            <div className="text-right margin-t12">
              <Pagination
                page={page}
                total={total}
                limit={limit}
                onChange={this.handlePagination}
              />
            </div>
          </div>
        )}
      </ul>
    )
  }

  get columns() {
    return [
      {
        dataIndex: 'name',
        title: t('NAME'),
        search: true,
      },
      {
        dataIndex: 'alias',
        title: t('ALIAS'),
        search: true,
      },
    ]
  }

  handleFilterChange = filters => {
    this.setState({
      filters,
    })
    this.handleSearch(filters)
  }

  renderJwtMismatchHint() {
    const { jwtMismatchClusters } = this.state
    if (isEmpty(jwtMismatchClusters)) {
      return null
    }

    const name = jwtMismatchClusters
      .map(item => showNameAndAlias(item))
      .join(', ')

    return (
      <div className={styles.jwtHint}>
        <div className={styles.jwtHintTitle}>
          {t('JWT_SECRET_MISMATCH_TITLE', { name })}
        </div>
        <p>{t('JWT_SECRET_MISMATCH_DESC')}</p>
        <p>{t('JWT_SECRET_MISMATCH_HOST_STEP')}</p>
        <pre className={styles.jwtCommand}>{HOST_JWT_SECRET_COMMAND}</pre>
        <p>{t('JWT_SECRET_MISMATCH_MEMBER_STEP')}</p>
        <pre className={styles.jwtCommand}>{MEMBER_CLUSTER_CONFIG_COMMAND}</pre>
        <p>{t('JWT_SECRET_MISMATCH_APPLY')}</p>
      </div>
    )
  }

  renderSearch() {
    return (
      <div className={styles.searchPanel}>
        <FilterInput
          placeholder={t('SEARCH_BY_NAME')}
          columns={this.columns}
          onChange={this.handleFilterChange}
          filters={this.state.filters}
        />
        <Button
          type="flat"
          icon="refresh"
          onClick={this.handleRefresh}
          data-test="cluster-refresh"
        />
        {this.enabledActions.includes('create') && (
          <Button
            type="control"
            onClick={this.showAddCluster}
            data-test="cluster-create"
          >
            {t('ADD_CLUSTER')}
          </Button>
        )}
      </div>
    )
  }

  render() {
    return (
      <div className={styles.wrapper}>
        <Banner
          className={styles.banner}
          icon="cluster"
          title={t('CLUSTER_MANAGEMENT')}
          description={t('CLUSTER_DESC')}
          extra={this.renderSearch()}
        />
        {this.renderList()}
      </div>
    )
  }
}

export default Clusters
