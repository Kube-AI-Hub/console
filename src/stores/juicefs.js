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

import { action, observable } from 'mobx'
import { get } from 'lodash'

import { to } from 'utils'

import BaseMonitoringStore from './monitoring/base'

const GROUP = 'juicefs.kubesphere.io/v1alpha1'

// Metric names as registered in the apiserver's PromQL template map. They are
// shared storage specific: the client metrics come from the mount pod, the volume
// numbers from kubelet's per-PVC stats (i.e. the JuiceFS directory quota).
export const PerformanceMetrics = {
  readBytes: 'juicefs_read_bytes',
  writtenBytes: 'juicefs_written_bytes',
  cacheHitRatio: 'juicefs_cache_hit_ratio',
  cacheReadLatency: 'juicefs_cache_read_latency',
  fuseLatency: 'juicefs_fuse_latency',
  fuseOps: 'juicefs_fuse_ops',
  objectErrors: 'juicefs_object_errors',
  objectUploading: 'juicefs_object_uploading',
  metaLatency: 'juicefs_meta_latency',
  cpuUsage: 'juicefs_cpu_usage',
}

/**
 * Shared storage (JuiceFS) store.
 *
 * Two data sources, deliberately kept apart:
 *   - the volume inventory comes from our own API, which joins PV/PVC with
 *     kubelet's usage. The quota it reports is the PV's spec.capacity, because
 *     that is the value the CSI driver writes into the directory quota on every
 *     mount - the only number that is actually enforced.
 *   - the performance series come from Prometheus through the standard monitoring
 *     endpoint, so they reuse the console's existing time-range machinery.
 */
export default class JuiceFSStore extends BaseMonitoringStore {
  module = 'juicefs'

  @observable
  volumes = []

  @observable
  volumesLoading = false

  @observable
  summary = {}

  @observable
  summaryLoading = false

  get apiPath() {
    return globals.app.isMultiCluster && this.cluster
      ? `/kapis/clusters/${this.cluster}/${GROUP}`
      : `/kapis/${GROUP}`
  }

  // The monitoring API is cluster scoped, so the base store's cluster handling
  // applies; nothing to override beyond the resource name it keys series by.
  resourceName = 'instance'

  @action
  async fetchVolumes() {
    this.volumesLoading = true
    const result = await to(request.get(`${this.apiPath}/volumes`))
    const items = get(result, 'items', [])

    this.volumes = Array.isArray(items) ? items : []
    this.volumesLoading = false
    return this.volumes
  }

  @action
  async fetchSummary() {
    this.summaryLoading = true
    const result = await to(request.get(`${this.apiPath}/summary`))

    this.summary = result || {}
    this.summaryLoading = false
    return this.summary
  }

  /**
   * Set a volume's quota. The apiserver patches the PV capacity and runs a
   * one-shot job so the JuiceFS directory quota changes immediately; on failure it
   * rolls the PV back and this rejects with the CLI's message.
   */
  @action
  async setQuota(name, capacity) {
    const result = await to(
      request.put(`${this.apiPath}/volumes/${name}`, { capacity })
    )
    if (get(result, 'error')) {
      throw new Error(get(result, 'error'))
    }
    await this.fetchVolumes()
    await this.fetchSummary()
    return result
  }

  fetchPerformance = (params = {}) =>
    this.fetchMetrics({
      metrics: Object.values(PerformanceMetrics),
      step: '5m',
      times: 100,
      ...params,
    })
}
