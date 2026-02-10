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
import { Button, Loading } from '@kube-design/components'

import { getDisplayName, getLocalTime, formatXpuDisplay } from 'utils'
import { getNodeRoles, getNodeStatus } from 'utils/node'
import { trigger } from 'utils/action'
import NodeStore from 'stores/node'

import DetailPage from 'clusters/containers/Base/Detail'
import { Status, Modal } from 'components/Base'
import KubeCtlModal from 'components/Modals/KubeCtl'
import GpuVirtModeModal from 'components/Modals/Node/GpuVirtMode'

import routes from './routes'
import './index.scss'

const GPU_MODE_POLL_INTERVAL_MS = 3000

@inject('rootStore')
@observer
@trigger
export default class NodeDetail extends React.Component {
  store = new NodeStore()

  _gpuModePollTimer = null

  componentDidMount() {
    this.fetchData()
    this.startGpuModePollIfNeeded()
  }

  componentDidUpdate() {
    this.startGpuModePollIfNeeded()
  }

  componentWillUnmount() {
    if (this._gpuModePollTimer) {
      clearInterval(this._gpuModePollTimer)
      this._gpuModePollTimer = null
    }
  }

  startGpuModePollIfNeeded = () => {
    if (this._gpuModePollTimer) {
      clearInterval(this._gpuModePollTimer)
      this._gpuModePollTimer = null
    }
    const detail = toJS(this.store.detail)
    const status = get(detail, 'status.nodeInfo.gpuModeStatus.status')
    if (status === 'in_progress') {
      this._gpuModePollTimer = setInterval(() => {
        this.fetchData()
      }, GPU_MODE_POLL_INTERVAL_MS)
    }
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
      {
        key: 'setGpuVirtMode',
        icon: 'gpu',
        text: t('SET_VGPU_MODE'),
        action: 'edit',
        show: () => this.hasGpuNode(),
        onClick: this.handleSetGpuVirtMode,
      },
    ]
  }

  hasGpuNode = () => {
    const detail = this.store.detail
    const nodeInfo = get(detail, 'status.nodeInfo') || detail.nodeInfo || {}
    return !!(
      nodeInfo.gpuVendor ||
      nodeInfo.virtualCardMode ||
      get(detail, 'labels.xpu-vendor')
    )
  }

  handleSetGpuVirtMode = () => {
    const modal = Modal.open({
      modal: GpuVirtModeModal,
      detail: toJS(this.store.detail),
      onOk: () => {
        Modal.close(modal)
        this.fetchData()
      },
    })
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
    const nodeInfo = get(detail, 'status.nodeInfo') || detail.nodeInfo || {}
    const gpuModeStatus = get(detail, 'status.nodeInfo.gpuModeStatus')
    const xpu =
      get(detail, 'labels.xpu') ||
      (get(detail, ['labels', 'xpu-vendor']) &&
      get(detail, ['labels', 'xpu-model'])
        ? `${get(detail, ['labels', 'xpu-vendor'])}-${get(detail, [
            'labels',
            'xpu-model',
          ])}`
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
        value: nodeInfo.operatingSystem
          ? t(nodeInfo.operatingSystem.toUpperCase())
          : '-',
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
        value: nodeInfo.architecture
          ? nodeInfo.architecture.toUpperCase()
          : '-',
      },
      ...(this.hasGpuNode()
        ? [
            {
              name: t('GPU_VIRT_MODE'),
              value: (() => {
                const modeToDisplay = mode =>
                  mode === 'default' ? t('GPU_MODE_DEFAULT') : mode
                let displayText = nodeInfo.virtualCardMode
                  ? modeToDisplay(nodeInfo.virtualCardMode)
                  : '-'
                if (gpuModeStatus?.status === 'in_progress') {
                  displayText = t('GPU_VIRT_MODE_SWITCHING', {
                    mode: gpuModeStatus.mode || '',
                  })
                } else if (gpuModeStatus?.status === 'failed') {
                  displayText = gpuModeStatus.message
                    ? `${t('GPU_VIRT_MODE_SWITCH_FAILED')}: ${
                        gpuModeStatus.message
                      }`
                    : t('GPU_VIRT_MODE_SWITCH_FAILED')
                } else if (
                  gpuModeStatus?.status === 'completed' &&
                  gpuModeStatus.mode
                ) {
                  displayText = modeToDisplay(gpuModeStatus.mode)
                }
                const inProgress = gpuModeStatus?.status === 'in_progress'
                return (
                  <div
                    className="gpu-virt-mode-attr-value"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      minHeight: 20,
                      lineHeight: '20px',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>{displayText}</span>
                    <Button
                      type="default"
                      size="small"
                      className="gpu-virt-mode-attr-btn"
                      style={{
                        height: 20,
                        minHeight: 20,
                        lineHeight: '18px',
                        padding: '0 8px',
                        marginLeft: 8,
                        flexShrink: 0,
                      }}
                      disabled={inProgress}
                      onClick={() => this.handleSetGpuVirtMode()}
                    >
                      {t('SET')}
                    </Button>
                  </div>
                )
              })(),
            },
          ]
        : []),
      ...(nodeInfo.gpuDriverVersion
        ? [{ name: t('GPU_DRIVER_VERSION'), value: nodeInfo.gpuDriverVersion }]
        : []),
      ...(nodeInfo.gpuEngineVersion
        ? [{ name: t('GPU_ENGINE_VERSION'), value: nodeInfo.gpuEngineVersion }]
        : []),
      ...(nodeInfo.deviceSplitCount !== undefined &&
      nodeInfo.deviceSplitCount !== ''
        ? [
            {
              name: t('GPU_DEVICE_SPLIT_COUNT'),
              value: String(nodeInfo.deviceSplitCount),
            },
          ]
        : []),
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
