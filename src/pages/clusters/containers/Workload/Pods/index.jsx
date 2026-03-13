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
import { Link } from 'react-router-dom'
import { Icon } from '@kube-design/components'

import { Indicator } from 'components/Base'
import Banner from 'components/Cards/Banner'
import { withClusterList, ListPage } from 'components/HOCs/withList'
import StatusReason from 'projects/components/StatusReason'
import ResourceTable from 'clusters/components/ResourceTable'

import { getLocalTime } from 'utils'
import { formatResourceItems } from 'utils/resource'
import { ICON_TYPES, PODS_STATUS } from 'utils/constants'
import PodStore from 'stores/pod'

import * as styles from './index.scss'

export default
@withClusterList({
  store: new PodStore(),
  module: 'pods',
  name: 'POD',
  rowKey: 'uid',
})
class Pods extends React.Component {
  componentDidMount() {
    localStorage.setItem('pod-detail-referrer', location.pathname)
  }

  get itemActions() {
    const { getData, name, trigger } = this.props
    return [
      {
        key: 'editYaml',
        icon: 'pen',
        text: t('EDIT_YAML'),
        action: 'edit',
        onClick: item =>
          trigger('resource.yaml.edit', {
            detail: item,
          }),
      },
      {
        key: 'delete',
        icon: 'trash',
        text: t('DELETE'),
        action: 'delete',
        onClick: item =>
          trigger('resource.delete', {
            type: name,
            detail: item,
            success: getData,
          }),
      },
    ]
  }

  getItemDesc = record => {
    const { status, type } = record.podStatus
    const desc =
      type !== 'running' && type !== 'completed' ? (
        <StatusReason
          status={type}
          reason={t(status)}
          data={record}
          type="pod"
        />
      ) : (
        t(type.toUpperCase())
      )

    return desc
  }

  getPodsStatus() {
    return PODS_STATUS.map(status => ({
      text: t(status.text),
      value: status.value,
    }))
  }

  getColumns = () => {
    const { getSortOrder } = this.props
    return [
      {
        title: t('NAME'),
        dataIndex: 'name',
        sorter: true,
        sortOrder: getSortOrder('name'),
        search: true,
        render: this.renderAvatar,
      },
      {
        title: t('STATUS'),
        dataIndex: 'status',
        filters: this.getPodsStatus(),
        isHideable: true,
        search: true,
        width: 80,
        render: (_, { podStatus }) => (
          <span>{t(podStatus.type.toUpperCase())}</span>
        ),
      },
      {
        title: t('NODE_SI'),
        dataIndex: 'node',
        isHideable: true,
        width: '18%',
        render: this.renderNode,
      },
      {
        title: t('POD_IP_ADDRESS'),
        dataIndex: 'podIp',
        isHideable: true,
        width: '15%',
      },
      {
        title: t('RESOURCE_LIMIT'),
        dataIndex: 'containers_limits',
        isHideable: true,
        width: 220,
        render: (_, record) => this.renderContainerResource(record, 'limits'),
      },
      {
        title: t('RESOURCE_REQUESTS'),
        dataIndex: 'containers_requests',
        isHideable: true,
        width: 120,
        render: (_, record) => this.renderContainerResource(record, 'requests'),
      },
      {
        title: t('UPDATE_TIME_TCAP'),
        dataIndex: 'startTime',
        sorter: true,
        sortOrder: getSortOrder('startTime'),
        isHideable: true,
        width: 150,
        render: time => getLocalTime(time).format('YYYY-MM-DD HH:mm:ss'),
      },
    ]
  }

  renderContainerResource = (record, type) => {
    if (!record.containers || record.containers.length === 0) return '-'
    const { resources = {} } = record.containers[0]
    const items = formatResourceItems(resources, type, {
      showGpuSubResources: false,
      simplifyGpuName: true,
    })
    if (items.length === 0) return '-'
    return (
      <>
        {items.map(item => (
          <div key={item}>{item}</div>
        ))}
      </>
    )
  }

  renderAvatar = (name, record) => {
    const { module } = this.props
    const { cluster } = this.props.match.params
    const { podStatus } = record
    return (
      <div className={styles.avatar}>
        <div className={styles.icon}>
          <Icon name={ICON_TYPES[module]} size={40} />
          <Indicator
            className={styles.indicator}
            type={podStatus.type}
            flicker
          />
        </div>
        <div>
          <Link
            className={styles.title}
            to={`/clusters/${cluster}/projects/${record.namespace}/${module}/${name}`}
          >
            {name}
          </Link>
          <div className={styles.desc}>{this.getItemDesc(record)}</div>
        </div>
      </div>
    )
  }

  renderNode = (_, record) => {
    const { cluster } = this.props.match.params
    const { node, nodeIp } = record

    if (!node) return '-'

    const text = t('NODE_IP', { node, ip: nodeIp })

    return <Link to={`/clusters/${cluster}/nodes/${node}`}>{text}</Link>
  }

  renderStatus = podStatus => (
    <Status type={podStatus.type} name={t(podStatus.type)} flicker />
  )

  render() {
    const { match, bannerProps, tableProps } = this.props
    return (
      <ListPage {...this.props}>
        <Banner {...bannerProps} />
        <ResourceTable
          {...tableProps}
          itemActions={this.itemActions}
          columns={this.getColumns()}
          hideColumn={['status']}
          onCreate={null}
          cluster={match.params.cluster}
        />
      </ListPage>
    )
  }
}
