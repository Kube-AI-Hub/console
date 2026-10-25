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

import { Notify } from '@kube-design/components'
import { compile as compilePath } from 'path-to-regexp'

// 一次 404 可能同时被详情 store 与全局 onunhandledrejection 看到，
// 这里用一个时间窗把重复提示压成一条。
const NOTIFY_DEDUPE_MS = 1000
// 详情页骨架在挂载时读这个记录，用来覆盖那些不经过 stores/base 的详情页
// （openpitrix 等）：它们只在全局错误里留下痕迹。
const RECENT_MS = 5000
let lastNotifiedAt = 0
let lastNotFound = { name: '', at: 0 }

/**
 * 详情请求的 404 判定。
 *
 * k8s 在不同路径下给出的 reason 大小写与空格不一致（`NotFound` / `Not Found`），
 * 所以两种都要认。500 的 message 里也可能出现 "not found"（例如
 * `create job failed: storageclass not found`），因此只有 status 明确是 404
 * 时才认为对象不存在，绝不只按文案匹配。
 */
export const isNotFound = error => {
  if (!error) {
    return false
  }

  const status = Number(error.status || error.code || error.statusCode)
  if (status === 404) {
    return true
  }

  return error.reason === 'NotFound' || error.reason === 'Not Found'
}

/**
 * 从后端 message 里取资源名：`pods "agent-platform-web-xxx" not found`。
 * 取不到时返回空串，提示退化为不带名字的文案。
 */
export const nameFromError = error => {
  const message = (error && (error.message || error.Error)) || ''
  const match = /["']([^"']+)["']/.exec(message)
  return match ? match[1] : ''
}

/**
 * 从路由 / 请求参数里取资源名。不同资源的参数键不同（`name` / `podName` /
 * `node` / `containerName` / `repo_id` / `app_id`），按优先级取第一个非空的。
 */
export const nameFromParams = params => {
  if (!params || typeof params !== 'object') {
    return ''
  }
  return (
    params.name ||
    params.podName ||
    params.node ||
    params.containerName ||
    params.gatewayName ||
    params.repo_id ||
    params.app_id ||
    params.appId ||
    params.id ||
    ''
  )
}

/**
 * 资源不存在的提示。标题与正文都来自 i18n，不展示后端 reason / message 原文。
 */
export const notifyResourceNotFound = name => {
  const now = Date.now()
  if (now - lastNotifiedAt < NOTIFY_DEDUPE_MS) {
    return
  }
  lastNotifiedAt = now

  const resourceName = name || ''
  lastNotFound = { name: resourceName, at: now }

  Notify.warning({
    title: t('RESOURCE_NOT_FOUND_TITLE'),
    content: resourceName
      ? t('RESOURCE_NOT_FOUND_DESC', { name: resourceName })
      : t('RESOURCE_NOT_FOUND_DESC_NO_NAME'),
    duration: 6000,
  })
}

/**
 * 最近是否刚发生过「这个资源」的 404。详情页骨架挂载时用它兜底：有些 store
 * （openpitrix、部分 devops 页）不走 `stores/base.js`，只能从全局错误里知道
 * 这件事。带上资源名，避免上一个页面的 404 把当前页面也带偏。
 */
export const recentlyNotFound = name =>
  lastNotFound.name === (name || '') && Date.now() - lastNotFound.at < RECENT_MS

/**
 * 给一个 store 的 `fetchDetail` 加 404 守卫。
 *
 * 详情页的 `render()` 在 `isLoading && !detail.name` 时会一直返回 Loading，
 * 骨架根本不会挂载，所以「不存在」必须在这里结束加载并留下标记。
 *
 * `stores/base.js` 的构造器会自动调用它；用实例字段 `fetchDetail = async ...`
 * 定义的 store（字段初始化在 `super()` 之后）需要在构造器里再调一次。
 */
export const guardNotFound = store => {
  if (!store) {
    return store
  }

  const fetchDetail = store.fetchDetail
  if (typeof fetchDetail !== 'function' || fetchDetail.__notFoundGuarded) {
    return store
  }

  const guarded = async (...args) => {
    store.notFound = false
    try {
      return await fetchDetail.apply(store, args)
    } catch (error) {
      if (!isNotFound(error)) {
        throw error
      }
      store.notFound = true
      store.isLoading = false
      notifyResourceNotFound(nameFromParams(args[0]) || nameFromError(error))
      return undefined
    }
  }

  guarded.__notFoundGuarded = true
  store.fetchDetail = guarded

  return store
}

const compile = (url, params) => {
  const [pathname, search] = String(url).split('?')
  try {
    const compiled = compilePath(pathname)(params || {})
    return search ? `${compiled}?${search}` : compiled
  } catch (e) {
    return url
  }
}

/**
 * 详情页「上一级」列表地址。
 *
 * 优先用页面自己声明的 `breadcrumbs[0].url`（它天然带集群 / 命名空间，也
 * 可能是带 `:cluster` 这类占位符的模板）。
 *
 * 但有些页面的 `listUrl` 会丢掉当前路由的作用域：Pod 详情走的是
 * `/clusters/:cluster/projects/:namespace/pods/:podName`，而它的面包屑在
 * 没有 workspace 参数时给的是集群级 `/clusters/:cluster/pods`。这种情况按
 * `match.path` 去掉尾部参数段推导，保住项目上下文。
 */
export const listUrlFor = ({ breadcrumbs, match } = {}) => {
  const params = (match && match.params) || {}
  const first = (breadcrumbs || [])[0]
  const breadcrumbUrl = first && first.url ? compile(first.url, params) : ''
  const derivedUrl = derivedListUrl(match)

  if (breadcrumbUrl) {
    const namespace = params.namespace
    const losesProject =
      namespace &&
      derivedUrl &&
      !breadcrumbUrl.includes(`/projects/${namespace}`) &&
      derivedUrl.includes(`/projects/${namespace}`)

    return losesProject ? derivedUrl : breadcrumbUrl
  }

  return derivedUrl
}

/**
 * 从 `match.path` 推导列表地址：从尾部逐个去掉参数段（`:name`），停在第一个
 * 字面量段上。
 *
 *   /clusters/:cluster/projects/:namespace/pods/:podName  → /clusters/:cluster/projects/:namespace/pods
 *   /clusters/:cluster/nodes/:node                       → /clusters/:cluster/nodes
 *   /clusters/:cluster/pv/:name                          → /clusters/:cluster/pv
 */
const derivedListUrl = match => {
  const path = (match && match.path) || ''
  const params = (match && match.params) || {}
  const all = path.split('/').filter(Boolean)
  const segments = [...all]

  while (segments.length > 0 && segments[segments.length - 1].startsWith(':')) {
    segments.pop()
  }

  // 一段参数都没去掉：当前路由不是详情页，没有可推导的上一级。
  if (segments.length === all.length || segments.length === 0) {
    return ''
  }

  // 缺参数时 compile 会抛错并退化成带冒号的字面量路径，那还不如不跳。
  const missing = segments.some(
    segment => segment.startsWith(':') && !params[segment.slice(1)]
  )
  if (missing) {
    return ''
  }

  return compile(`/${segments.join('/')}`, params)
}
