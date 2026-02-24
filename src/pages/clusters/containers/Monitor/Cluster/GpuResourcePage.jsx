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
 * GNU Affero General License for more details.
 *
 * You should have received a copy of the GNU Affero General License
 * along with KubeSphere Console.  If not, see <https://www.gnu.org/licenses/>.
 */

import React from 'react'
import Banner from 'components/Cards/Banner'
import { renderRoutes, getIndexRoute } from 'utils/router.config'

import GPUResourceOverview from './GPUResource/Overview'
import GPUPhysicalMonitoring from './GPUResource/PhysicalMonitoring'
import GPURanking from './GPUResource/Ranking'

export default class GpuResourcePage extends React.Component {
  get path() {
    return this.props.match.path
  }

  get routes() {
    const path = this.path
    return [
      {
        path: `${path}/overview`,
        title: 'GPU_OVERVIEW',
        name: 'overview',
        component: GPUResourceOverview,
        exact: true,
      },
      {
        path: `${path}/physical`,
        title: 'GPU_PHYSICAL_MONITORING',
        name: 'physical',
        component: GPUPhysicalMonitoring,
        exact: true,
      },
      {
        path: `${path}/ranking`,
        title: 'GPU_USAGE_RANKING',
        name: 'ranking',
        component: GPURanking,
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
          icon="linechart"
          title={t('GPU_RESOURCE')}
          description={t('GPU_RESOURCE_DESC')}
          routes={this.bannerRoutes}
        />
        {renderRoutes(this.routes)}
      </>
    )
  }
}
