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

import { observable, action } from 'mobx'
import { get } from 'lodash'

import ObjectMapper from 'utils/object.mapper'
import { getWorkloadVolumes } from 'utils/workload'
import { encrypt } from 'utils'
import List from './base.list'

export default class ContainerStore {
  @observable
  detail = {}

  @observable
  tagList = new List()

  @observable
  isLoading = true

  @observable
  volumes = []

  @observable
  logs = {
    data: '',
    isLoading: true,
  }

  watchHandler = null
  tailProbeTimer = null
  tailProbeFingerprint = ''
  tailProbeInFlight = false
  tailProbeKey = ''

  encryptKey = get(globals, 'config.encryptKey', 'kubesphere')

  module = 'containers'

  normalizeLogText = text =>
    String(text || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')

  extractLastTimestamp = text => {
    const normalized = this.normalizeLogText(text)
    const re = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})/g
    let match = null
    let last = ''
    while ((match = re.exec(normalized))) {
      last = match[0]
    }
    return last
  }

  fingerprintTail = (text, lines = 5) => {
    const items = this.normalizeLogText(text)
      .split('\n')
      .filter(Boolean)
    if (!items.length) {
      return ''
    }
    return items.slice(-lines).join('\n')
  }

  mergeLogsByOverlap = (baseText, newText, maxOverlapLines = 50) => {
    const baseLines = this.normalizeLogText(baseText).split('\n')
    const newLines = this.normalizeLogText(newText).split('\n')

    // trim trailing empty line to stabilize comparisons
    if (baseLines.length > 0 && baseLines[baseLines.length - 1] === '') {
      baseLines.pop()
    }
    if (newLines.length > 0 && newLines[newLines.length - 1] === '') {
      newLines.pop()
    }

    const max = Math.min(maxOverlapLines, baseLines.length, newLines.length)
    for (let k = max; k > 0; k--) {
      let ok = true
      for (let i = 0; i < k; i++) {
        if (baseLines[baseLines.length - k + i] !== newLines[i]) {
          ok = false
          break
        }
      }
      if (ok) {
        return [...baseLines, ...newLines.slice(k)].join('\n')
      }
    }

    return [...baseLines, ...newLines].join('\n')
  }

  stopTailProbe = () => {
    if (this.tailProbeTimer) {
      clearInterval(this.tailProbeTimer)
      this.tailProbeTimer = null
    }
    this.tailProbeFingerprint = ''
    this.tailProbeInFlight = false
    this.tailProbeKey = ''
  }

  getDetailUrl = ({ cluster, namespace, podName, gateways }) => {
    let path = `api/v1`

    if (cluster) {
      path += `/klusters/${cluster}`
    }

    if (gateways) {
      const ns =
        namespace === 'kubesphere-controls-system' || !namespace
          ? 'kubesphere-system'
          : namespace
      return `kapis/gateway.kubesphere.io/v1alpha1/namespaces/${ns}/gateways/${gateways}/pods/${podName}`
    }

    return `${path}/namespaces/${namespace}/pods/${podName}`
  }

  getPath = ({ cluster, namespace }) => {
    let path = ''

    if (cluster) {
      path += `/klusters/${cluster}`
    }

    if (namespace) {
      path += `/namespaces/${namespace}`
    }

    return path
  }

  @action
  async fetchDetail({ cluster, namespace, podName, containerName }) {
    this.isLoading = true

    const result = await request.get(
      this.getDetailUrl({ cluster, namespace, podName })
    )
    const pod = ObjectMapper.pods(result)
    const detail =
      pod.containers.find(item => item.name === containerName) ||
      pod.initContainers.find(item => item.name === containerName)
    detail.createTime = get(pod, 'createTime', '')
    detail.app = detail.app || pod.app
    detail.cluster = cluster
    pod.cluster = cluster

    this.volumes = await getWorkloadVolumes(pod)

    this.detail = detail
    this.isLoading = false
  }

  @action
  async watchLogs(
    { cluster, namespace, podName, gateways, silent, ...params },
    callback
  ) {
    if (!silent) {
      this.logs.isLoading = true
    }

    if (params.follow) {
      this.stopTailProbe()

      const url = `${this.getDetailUrl({ cluster, namespace, podName, gateways })}/log`
      const probeKey = JSON.stringify({ cluster, namespace, podName, gateways, params })
      this.tailProbeKey = probeKey

      // First fetch complete logs with follow=false to ensure we have all data
      // This works around K8s API buffering issue where the last few lines
      // may not be flushed immediately in follow mode
      const initialResult = await request.get(
        url,
        { ...params, follow: false }
      )

      this.logs = {
        data: initialResult,
        isLoading: false,
      }
      callback()

      // Then start watching for new logs
      // Only update logs if streaming data is longer (has more content)
      this.watchHandler = request.watch(
        url,
        params,
        data => {
          const currentLength = this.logs && this.logs.data ? this.logs.data.length : 0
          // Only update if streaming returned more data than current view
          if (data && data.length > currentLength) {
            this.logs = {
              data,
              isLoading: false,
            }
            callback()
          }
        }
      )

      // 1Hz tail probe: cheap check (tailLines=20). If tail changes, backfill once.
      this.tailProbeTimer = setInterval(async () => {
        if (this.tailProbeInFlight) {
          return
        }
        if (this.tailProbeKey !== probeKey) {
          return
        }
        this.tailProbeInFlight = true

        try {
          const probeResult = await request.get(url, {
            container: params.container,
            timestamps: params.timestamps,
            follow: false,
            tailLines: 20,
          })

          const fp = this.fingerprintTail(probeResult, 5)
          if (!fp || fp === this.tailProbeFingerprint) {
            this.tailProbeInFlight = false
            return
          }
          this.tailProbeFingerprint = fp

          const lastTs = this.extractLastTimestamp(this.logs && this.logs.data)
          const backfillParams = lastTs
            ? {
                container: params.container,
                timestamps: params.timestamps,
                follow: false,
                sinceTime: lastTs,
              }
            : { ...params, follow: false }

          const backfillResult = await request.get(url, backfillParams)
          if (backfillResult) {
            const merged = this.mergeLogsByOverlap(this.logs && this.logs.data, backfillResult)
            if (merged && this.logs && merged.length > (this.logs.data || '').length) {
              this.logs = {
                data: merged,
                isLoading: false,
              }
              callback()
            }
          }
        } catch (e) {
          // ignore probe/backfill errors to avoid breaking realtime logs
        } finally {
          this.tailProbeInFlight = false
        }
      }, 1000)
    } else {
      this.stopTailProbe()
      const result = await request.get(
        `${this.getDetailUrl({ cluster, namespace, podName, gateways })}/log`,
        params
      )

      this.logs = {
        data: result,
        isLoading: false,
      }

      callback()
    }
  }

  @action
  stopWatchLogs() {
    this.watchHandler && this.watchHandler.abort()
    this.stopTailProbe()
  }

  async checkPreviousLog({ cluster, namespace, podName, ...params }) {
    const result = await request.get(
      `${this.getDetailUrl({ cluster, namespace, podName })}/log`,
      params,
      {},
      () => {}
    )

    return !!result
  }

  @action
  async fetchAllLogs({ cluster, namespace, podName, ...params }) {
    return await request.get(
      `${this.getDetailUrl({ cluster, namespace, podName })}/log`,
      params
    )
  }

  @action
  getDockerImagesLists = async params => {
    const controller = new AbortController()

    const timeout = new Promise(() => {
      setTimeout(() => {
        controller.abort()
      }, 3000)
    })

    const result = await Promise.race([
      request.post(
        `dockerhub/api/content/v1/products/search`,
        params,
        {
          headers: {
            'Search-Version': 'v3',
          },
          signal: controller.signal,
        },
        () => {}
      ),
      timeout,
    ]).catch(() => {
      return {}
    })
    return result
  }

  @action
  getHarborImagesLists = async ({ params, harborData }) =>
    await request.post(`harbor/search`, {
      harborData: encrypt(this.encryptKey, JSON.stringify(harborData)),
      params,
    })

  @action
  getHarborImageTag = async (harborData, projectName, repositoryName, params) =>
    await request.post(`harbor/artifacts`, {
      harborData: encrypt(
        this.encryptKey,
        JSON.stringify({ ...harborData, projectName, repositoryName })
      ),
      params,
    })

  @action
  getImageDetail = async ({ cluster, namespace, ...params }) => {
    const result = await request.get(
      `kapis/resources.kubesphere.io/v1alpha3${this.getPath({
        cluster,
      })}/namespaces/${namespace}/imageconfig`,
      params,
      null,
      (e, data) => data
    )

    if (get(result, 'status', 'succeeded') !== 'succeeded') {
      return { status: 'failed', message: result.message }
    }

    return ObjectMapper.imageBlob(result)
  }

  @action
  getImageTagList = async ({
    namespace,
    cluster,
    more,
    limit = 10,
    ...params
  }) => {
    this.tagList.isLoading = true

    if (limit === Infinity || limit === -1) {
      limit = -1
      params.page = 1
    }

    const result = await request.get(
      `kapis/resources.kubesphere.io/v1alpha3${this.getPath({
        cluster,
        namespace,
      })}/repositorytags`,
      { ...params, limit },
      null,
      (e, data) => data
    )

    const data = result.tags || []

    this.tagList.update({
      data: more ? [...this.tagList.data, ...data] : data,
      total: result.total || data.length || 0,
      limit: Number(params.limit) || 10,
      page: Number(params.page) || 1,
      isLoading: false,
    })

    return result.tags
  }

  @action
  updateTagList = data => {
    this.tagList.update(data)
  }
}
