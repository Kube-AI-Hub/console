import { action, observable } from 'mobx'
import { get, isEmpty } from 'lodash'

export default class GpuDetailStore {
  @observable
  detail = {}

  @observable
  isLoading = false

  @action
  async fetchDetail({ cluster, nodeName, gpuUuid }) {
    this.isLoading = true
    try {
      const decodedUuid = decodeURIComponent(gpuUuid || '')
      const params = {
        conditions: `nodeName=${nodeName}${
          decodedUuid ? `,uuid=${decodedUuid}` : ''
        }`,
      }
      if (cluster) params.cluster = cluster
      const result = await request.get(
        '/kapis/gpu.kubesphere.io/v1alpha1/gpus',
        params
      )
      const items = get(result, 'items', [])
      const target = items.find(item => item.uuid === decodedUuid)
      this.detail = isEmpty(target) ? {} : target
      return this.detail
    } finally {
      this.isLoading = false
    }
  }
}
