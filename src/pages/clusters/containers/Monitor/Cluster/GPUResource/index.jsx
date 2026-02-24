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
 * You should have received a copy of the GNU Affero General Public License
 * along with KubeSphere Console.  If not, see <https://www.gnu.org/licenses/>.
 */

import React from 'react'
import { Tabs } from '@kube-design/components'

import GPUResourceOverview from './Overview'
import GPUPhysicalMonitoring from './PhysicalMonitoring'
import GPURanking from './Ranking'

const { TabPanel } = Tabs

export default class GPUResource extends React.Component {
  get cluster() {
    return this.props.match.params.cluster
  }

  render() {
    return (
      <Tabs type="button" defaultActiveName="overview">
        <TabPanel name="overview" label={t('GPU_OVERVIEW')}>
          <GPUResourceOverview cluster={this.cluster} />
        </TabPanel>
        <TabPanel name="physical" label={t('GPU_PHYSICAL_MONITORING')}>
          <GPUPhysicalMonitoring cluster={this.cluster} />
        </TabPanel>
        <TabPanel name="ranking" label={t('GPU_USAGE_RANKING')}>
          <GPURanking cluster={this.cluster} />
        </TabPanel>
      </Tabs>
    )
  }
}
