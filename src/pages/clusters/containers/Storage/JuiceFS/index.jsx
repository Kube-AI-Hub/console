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

import Banner from 'components/Cards/Banner'
import { renderRoutes, getIndexRoute } from 'utils/router.config'
import JuiceFSStore from 'stores/juicefs'

import SharedOverview from './Overview'
import SharedVolumes from './Volumes'
import SharedPerformance from './Performance'

/**
 * Shared storage page: the JuiceFS volumes the platform mounts, their quotas and
 * their performance.
 *
 * Three tabs, matching the three questions an operator asks: is anything close to
 * full (overview), what exactly does each volume hold and can I change it
 * (volumes), and why is a model load slow (performance).
 */
@inject('rootStore')
@observer
export default class JuiceFSStorage extends React.Component {
  constructor(props) {
    super(props)
    // Same pattern as the cluster monitoring page: one store per page, registered
    // on the root store so the tabs share the fetched data.
    this.store = new JuiceFSStore({ cluster: this.cluster })
    props.rootStore.register('juicefs', this.store)
  }

  get cluster() {
    return this.props.match.params.cluster
  }

  get path() {
    return this.props.match.path
  }

  get routes() {
    const path = this.path
    return [
      {
        path: `${path}/overview`,
        title: 'SHARED_STORAGE_OVERVIEW',
        name: 'overview',
        component: SharedOverview,
        exact: true,
      },
      {
        path: `${path}/volumes`,
        title: 'SHARED_STORAGE_VOLUMES',
        name: 'volumes',
        component: SharedVolumes,
        exact: true,
      },
      {
        path: `${path}/performance`,
        title: 'SHARED_STORAGE_PERFORMANCE',
        name: 'performance',
        component: SharedPerformance,
        exact: true,
      },
      getIndexRoute({ path, to: `${path}/overview`, exact: true }),
    ]
  }

  get bannerRoutes() {
    return this.routes
      .filter(item => !!item.title)
      .map(item => ({
        ...item,
        name: item.name || item.path.split('/').pop(),
      }))
  }

  render() {
    return (
      <>
        <Banner
          icon="database"
          title={t('SHARED_STORAGE')}
          description={t('SHARED_STORAGE_DESC')}
          routes={this.bannerRoutes}
        />
        {renderRoutes(this.routes)}
      </>
    )
  }
}
