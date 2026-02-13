import React from 'react'
import { toJS } from 'mobx'
import { observer, inject } from 'mobx-react'
import { get, isEmpty } from 'lodash'
import { Loading } from '@kube-design/components'

import { getVendorDisplayName } from 'utils'
import NodeStore from 'stores/node'

import DetailPage from 'clusters/containers/Base/Detail'
import { Status } from 'components/Base'

import GpuDetailStore from './store'
import routes from './routes'

@inject('rootStore')
@observer
export default class GpuDetail extends React.Component {
  gpuStore = new GpuDetailStore()

  nodeStore = new NodeStore()

  componentDidMount() {
    this.fetchData()
  }

  componentDidUpdate(prevProps) {
    const { gpuUuid, node } = this.props.match.params
    const { gpuUuid: prevGpuUuid, node: prevNode } = prevProps.match.params
    if (gpuUuid !== prevGpuUuid || node !== prevNode) {
      this.fetchData()
    }
  }

  get cluster() {
    return this.props.match.params.cluster
  }

  get nodeName() {
    return this.props.match.params.node
  }

  get gpuUuid() {
    return this.props.match.params.gpuUuid
  }

  fetchData = () => {
    this.gpuStore.fetchDetail({
      nodeName: this.nodeName,
      gpuUuid: this.gpuUuid,
    })
    this.nodeStore.fetchDetail({
      name: this.nodeName,
      cluster: this.cluster,
    })
  }

  getAttrs = () => {
    const detail = toJS(this.gpuStore.detail)
    if (isEmpty(detail)) return []

    const nodeDetail = toJS(this.nodeStore.detail)
    const nodeInfo =
      get(nodeDetail, 'status.nodeInfo') || nodeDetail.nodeInfo || {}

    const healthy = get(detail, 'health', false)
    const healthStatus = (
      <Status
        type={healthy ? 'Running' : 'Warning'}
        name={healthy ? t('HEALTHY') : t('SUB_HEALTHY')}
      />
    )

    const gpuMemoryTotal = (
      Number(get(detail, 'gpuMemoryTotal', 0)) / 1024
    ).toFixed(2)

    return [
      { name: t('STATUS'), value: healthStatus },
      { name: t('GPU_DETAIL_NODE'), value: this.nodeName },
      { name: t('GPU_CARD_ID'), value: get(detail, 'uuid', '-') },
      {
        name: t('GPU_CARD_INDEX'),
        value:
          get(detail, 'index') !== undefined
            ? String(get(detail, 'index'))
            : '-',
      },
      { name: t('GPU_CARD_MODEL'), value: get(detail, 'type', '-') },
      {
        name: t('GPU_CARD_VENDOR'),
        value: getVendorDisplayName(get(detail, 'deviceVendor', '')) || '-',
      },
      {
        name: t('GPU_CARD_NUMA'),
        value:
          get(detail, 'numa') !== undefined && get(detail, 'numa') !== null
            ? String(get(detail, 'numa'))
            : '-',
      },
      { name: t('GPU_CARD_MODE'), value: get(detail, 'mode', '') || '-' },
      {
        name: t('GPU_MEMORY_TOTAL'),
        value: `${gpuMemoryTotal} GiB`,
      },
      {
        name: t('GPU_VIRT_MODE'),
        value: nodeInfo.virtualCardMode
          ? nodeInfo.virtualCardMode === 'default'
            ? t('GPU_MODE_DEFAULT')
            : nodeInfo.virtualCardMode
          : '-',
      },
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
    ]
  }

  render() {
    const detail = toJS(this.gpuStore.detail)

    const stores = {
      detailStore: this.nodeStore,
      gpuDetailStore: this.gpuStore,
    }

    if (this.gpuStore.isLoading && isEmpty(detail)) {
      return <Loading className="ks-page-loading" />
    }

    const gpuName =
      get(detail, 'type', '') ||
      decodeURIComponent(this.gpuUuid || '').substring(0, 12)
    const gpuIndex = get(detail, 'index')
    const displayName =
      gpuIndex !== undefined ? `GPU #${gpuIndex} (${gpuName})` : gpuName

    const sideProps = {
      module: 'nodes',
      icon: 'gpu',
      name: displayName,
      desc: get(detail, 'uuid', ''),
      attrs: this.getAttrs(),
      breadcrumbs: [
        {
          label: t('GPU_CARD_SCAP'),
          url: `/clusters/${this.cluster}/nodes/${this.nodeName}/status`,
        },
      ],
    }

    return <DetailPage stores={stores} routes={routes} {...sideProps} />
  }
}
