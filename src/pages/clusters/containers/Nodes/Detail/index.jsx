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
import { toJS } from 'mobx'
import { observer, inject } from 'mobx-react'
import { get, isEmpty } from 'lodash'
import { Loading } from '@kube-design/components'

import { getDisplayName, getLocalTime, formatXpuDisplay } from 'utils'
import { getNodeRoles, getNodeStatus } from 'utils/node'
import { trigger } from 'utils/action'
import NodeStore from 'stores/node'

import DetailPage from 'clusters/containers/Base/Detail'
import { Status, Modal } from 'components/Base'
import KubeCtlModal from 'components/Modals/KubeCtl'

import routes from './routes'

@inject('rootStore')
@observer
@trigger
export default class NodeDetail extends React.Component {
  store = new NodeStore()

  componentDidMount() {
    this.fetchData()
  }

  get module() {
    return 'nodes'
  }

  get name() {
    return 'CLUSTER_NODE'
  }

  get listUrl() {
    const { cluster } = this.props.match.params
    return `/clusters/${cluster}/nodes`
  }

  fetchData = () => {
    const { cluster, node } = this.props.match.params
    this.store.fetchDetail({ name: node, cluster })
  }

  getOperations = () => {
    const { unschedulable } = this.store.detail

    return [
      {
        key: 'cordon',
        type: unschedulable ? 'control' : 'danger',
        text: unschedulable ? t('UNCORDON') : t('CORDON'),
        action: 'edit',
        onClick: this.handleCordon,
      },
      {
        key: 'terminal',
        icon: 'terminal',
        text: t('OPEN_TERMINAL'),
        action: 'edit',
        show: () =>
          this.store.detail.importStatus === 'success' &&
          this.getReady(this.store.detail),
        onClick: this.handleOpenTerminal,
      },
      {
        key: 'eidtLabel',
        icon: 'pen',
        text: t('EDIT_LABELS'),
        action: 'edit',
        onClick: () =>
          this.trigger('node.labels', {
            title: t('LABEL_PL'),
            detail: this.store.detail,
            success: this.fetchData,
          }),
      },
      {
        key: 'taintManagement',
        icon: 'wrench',
        text: t('EDIT_TAINTS'),
        action: 'edit',
        onClick: () =>
          this.trigger('node.taint', {
            detail: this.store.detail,
            success: this.fetchData,
          }),
      },
    ]
  }

  getXpuTypeTooltip = () => {
    return (
      <div>
        <div>{t('XPU_TYPE_TIP_SOURCE')}</div>
        <div>{t('XPU_TYPE_TIP_FORMAT')}</div>
        <div>{t('XPU_TYPE_TIP_EXAMPLES')}</div>
        <div>{t('XPU_TYPE_TIP_DEFAULT')}</div>
      </div>
    )
  }

  getAttrs = () => {
    const detail = toJS(this.store.detail)

    if (isEmpty(detail)) {
      return
    }

    const statusStr = getNodeStatus(detail)
    const status = (
      <Status
        type={statusStr}
        name={t(`NODE_STATUS_${statusStr.toUpperCase()}`)}
      />
    )
    const address = get(detail, 'status.addresses[0].address', '-')
    const nodeInfo = detail.nodeInfo || {}
    const xpu =
      get(detail, 'labels.xpu') ||
      (get(detail, ['labels', 'xpu-vendor']) &&
      get(detail, ['labels', 'xpu-model'])
        ? `${get(detail, ['labels', 'xpu-vendor'])}-${get(detail, ['labels', 'xpu-model'])}`
        : null) ||
      'CPU'

    return [
      {
        name: t('STATUS'),
        value: status,
      },
      {
        name: t('IP_ADDRESS'),
        value: address,
      },
      {
        name: t('ROLE'),
        value:
          getNodeRoles(detail.labels).indexOf('master') === -1
            ? t('WORKER')
            : t('CONTROL_PLANE'),
      },
      {
        name: t('XPU_TYPE'),
        value: formatXpuDisplay(xpu),
        tooltips: this.getXpuTypeTooltip(),
      },
      {
        name: t('OS_VERSION'),
        value: nodeInfo.osImage,
      },
      {
        name: t('OS_TYPE'),
        value: t(nodeInfo.operatingSystem.toUpperCase()),
      },
      {
        name: t('KERNEL_VERSION'),
        value: nodeInfo.kernelVersion,
      },
      {
        name: t('CONTAINER_RUNTIME'),
        value: nodeInfo.containerRuntimeVersion,
      },
      {
        name: t('KUBELET_VERSION'),
        value: nodeInfo.kubeletVersion,
      },
      {
        name: t('KUBE_PROXY_VERSION'),
        value: nodeInfo.kubeProxyVersion,
      },
      {
        name: t('ARCHITECTURE'),
        value: nodeInfo.architecture.toUpperCase(),
      },
      {
        name: t('CREATION_TIME_TCAP'),
        value: getLocalTime(detail.createTime).format('YYYY-MM-DD HH:mm:ss'),
      },
    ]
  }

  getReady = record => {
    const conditions = record.conditions || []

    return conditions.some(
      condition => condition.type === 'Ready' && condition.status === 'True'
    )
  }

  handleOpenTerminal = () => {
    const detail = toJS(this.store.detail)
    const { cluster } = this.props.match.params

    const modal = Modal.open({
      onOk: () => {
        Modal.close(modal)
      },
      modal: KubeCtlModal,
      cluster,
      title: detail.name,
      nodename: detail.name,
      isEdgeNode: true,
    })
  }

  handleCordon = () => {
    const detail = toJS(this.store.detail)

    if (detail.unschedulable) {
      this.store.uncordon(detail).then(this.fetchData)
    } else {
      this.store.cordon(detail).then(this.fetchData)
    }
  }

  render() {
    const stores = { detailStore: this.store }

    if (this.store.isLoading && !this.store.detail.name) {
      return <Loading className="ks-page-loading" />
    }

    const sideProps = {
      module: this.module,
      name: getDisplayName(this.store.detail),
      desc: this.store.detail.description,
      operations: this.getOperations(),
      attrs: this.getAttrs(),
      breadcrumbs: [
        {
          label: t('CLUSTER_NODE_PL'),
          url: this.listUrl,
        },
      ],
    }

    return <DetailPage stores={stores} routes={routes} {...sideProps} />
  }
}
