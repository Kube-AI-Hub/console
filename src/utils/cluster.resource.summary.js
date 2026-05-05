/*
 * This file is part of KubeSphere Console.
 * Copyright 2019 The KubeSphere Console Authors.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import request from 'utils/request'

const summaryUrl = cluster =>
  `kapis/resources.kubesphere.io/v1alpha3/klusters/${cluster}/cluster-resources/summary`

/**
 * @param {string[]} clusterNames
 * @returns {Promise<{
 *   availableGpuResourceNames: string[],
 *   totals: { cpu: string, memory: string, gpuResources: { resourceName: string, total: string }[] },
 *   federatedMultiCluster?: boolean
 * }|null>}
 */
export async function fetchMergedClusterResourceSummary(clusterNames) {
  const cleaned = [...new Set(clusterNames || [])].filter(Boolean)
  if (!cleaned.length) {
    return null
  }

  if (cleaned.length === 1) {
    const data = await request.get(summaryUrl(cleaned[0]))
    return {
      ...data,
      federatedMultiCluster: false,
    }
  }

  const results = await Promise.all(
    cleaned.map(c =>
      request.get(summaryUrl(c)).catch(() => null)
    )
  )
  const ok = results.filter(Boolean)
  const nameSet = new Set()
  ok.forEach(r => {
    ;(r.availableGpuResourceNames || []).forEach(n => nameSet.add(n))
  })
  return {
    availableGpuResourceNames: [...nameSet].sort(),
    totals: null,
    federatedMultiCluster: true,
  }
}

export async function fetchClusterResourceSummary(cluster) {
  if (!cluster) return null
  return request.get(summaryUrl(cluster))
}
