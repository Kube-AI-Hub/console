import { action, observable } from 'mobx'
import { isEmpty } from 'lodash'

export default class GpuDetailStore {
  @observable
  detail = {}

  @observable
  isLoading = false

  @action
  async fetchDetail({ nodeName, gpuUuid }) {
    this.isLoading = true
    try {
      const result = await request.get(
        '/kapis/gpu.kubesphere.io/v1alpha1/gpus',
        { conditions: `nodeName=${nodeName}` }
      )
      const decodedUuid = decodeURIComponent(gpuUuid || '')
      const target = (result || []).find(item => item.uuid === decodedUuid)
      this.detail = isEmpty(target) ? {} : target
      return this.detail
    } finally {
      this.isLoading = false
    }
  }
}
