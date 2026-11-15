/*
 * Copyright 2026 Kube AI Hub.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export const GPU_KAPIS_BASE = '/kapis/gpu.kubesphere.io/v1alpha1'
export const RDMA_KAPIS_BASE = '/kapis/rdma.kubesphere.io/v1alpha1'
export const JUICEFS_KAPIS_BASE = '/kapis/juicefs.kubesphere.io/v1alpha1'

export function withClusterQuery(params = {}, cluster) {
  if (cluster) {
    return { ...params, cluster }
  }
  return { ...params }
}

export function withClusterPath(url, cluster) {
  if (!cluster) {
    return url
  }
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}cluster=${encodeURIComponent(cluster)}`
}
