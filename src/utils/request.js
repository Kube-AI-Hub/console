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

import 'whatwg-fetch'
import qs from 'qs'
import { isObject, get, set, merge, isEmpty } from 'lodash'
import { Notify } from '@kube-design/components'

import { getClusterUrl, isMemberClusterPage, safeParseJSON } from './index'
import { getToken, removeToken } from './token'
import { isLoginRequestUrl, mapOAuthLoginMessage } from './loginError'

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

/**
 * This is our overly complicated isomorphic "request",
 * methods: get, post, put, patch, delete
 * @param url
 * @param params
 * @param options
 * @param reject
 * @returns {Function}
 */
export default methods.reduce(
  (prev, method) => ({
    ...prev,
    [method.toLowerCase()]: (url, params, options, reject) =>
      buildRequest({ method, url, params, options, reject }),
  }),
  {
    defaults: buildRequest,
    watch: watchResource,
  }
)

/**
 * Build and execute remote request
 * @param method
 * @param url
 * @param params
 * @param config
 */
function buildRequest({
  method = 'GET',
  url,
  params = {},
  options,
  reject,
  handler,
}) {
  let requestURL = createURL(url)
  const token = getToken()
  const request = merge(
    {
      method,
      mode: 'cors',
      credentials: 'include',
      headers: {
        'content-type':
          method === 'PATCH'
            ? 'application/merge-patch+json'
            : 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      url: requestURL, // 保存原始 URL 用于错误处理判断
    },
    options
  )

  const isForm =
    get(options, 'headers[content-type]', '').indexOf(
      'application/x-www-form-urlencoded'
    ) !== -1

  if (method === 'GET') {
    if (!isEmpty(params)) {
      requestURL += `?${qs.stringify(params)}`
    }
  } else if (isForm) {
    request.body = qs.stringify(params)
  } else {
    if (method === 'POST' && params.metadata) {
      set(
        params,
        'metadata.annotations["kubesphere.io/creator"]',
        globals.user.username
      )
      if (get(params, 'spec.template')) {
        set(
          params,
          'spec.template.metadata.annotations["kubesphere.io/creator"]',
          globals.user.username
        )
      }
    }
    request.body = JSON.stringify(params)
  }

  let responseHandler = handleResponse

  if (typeof handler === 'function') {
    responseHandler = handler
  }

  return fetch(getClusterUrl(requestURL), request).then(resp =>
    responseHandler(resp, reject, request)
  )
}

function watchResource(url, params, callback) {
  const xhr = new XMLHttpRequest()
  const token = getToken()

  xhr.open('GET', getClusterUrl(`/${url}?${qs.stringify(params)}`), true)

  if (token) {
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
  }

  xhr.onreadystatechange = () => {
    if (xhr.readyState >= 3 && xhr.status === 200) {
      callback(xhr.responseText)
    }
  }

  xhr.send()

  return xhr
}

/**
 * Prepend host of API server
 * @param path
 * @returns {String}
 * @private
 */
function createURL(path) {
  if (path.startsWith('http')) {
    return path
  }

  return `/${path.trimLeft('/')}`
}

/**
 * Decide what to do with the response
 * @param response
 * @returns {Promise}
 * @private
 */
function handleResponse(response, reject, request = {}) {
  const redirect = response.redirected
  if (redirect) {
    window.location.replace(response.url)
    return Promise.reject()
  }

  const contentType = response.headers.get('content-type')
  if (contentType && contentType.includes('json')) {
    return response.json().then(data => {
      const isLoginRequest = isLoginRequestUrl(request.url)

      if (response.status === 401) {
        console.warn('Unauthorized', response, response.ok)

        // 成员集群用自己的 token 缓存校验主集群签发的登录 token，缓存未命中时也是 401。
        // 这不是本机会话失效，不能清掉 token。
        const memberClusterTokenError = isMemberClusterPage(
          window.location.pathname,
          data.message || 'Please login again'
        )

        // 登录请求的 401 是正常的凭据错误；成员集群 token 校验失败也不是会话失效。
        if (!isLoginRequest && !memberClusterTokenError) {
          removeToken()
          const pathname = window.location.pathname
          if (pathname !== '/login') {
            window.location.replace(`/login?referer=${pathname}`)
          }
        }

        const loginError = {
          status: 401,
          reason: data.reason || 'Unauthorized',
          message: isLoginRequest
            ? mapOAuthLoginMessage(data, 401)
            : data.message || 'Please login again',
          error: data.error,
          error_description: data.error_description,
        }
        if (isLoginRequest) {
          loginError.source = 'login'
        }
        return Promise.reject(loginError)
      }

      // OAuth password grant failures: wrong password (400) or auth rate limit (429).
      if (
        isLoginRequest &&
        (response.status === 400 || response.status === 429)
      ) {
        return Promise.reject({
          status: response.status,
          reason: data.error || response.statusText,
          message: mapOAuthLoginMessage(data, response.status),
          error: data.error,
          error_description: data.error_description,
          source: 'login',
        })
      }

      if (response.status === 403) {
        console.warn('Forbidden', response, response.ok)
        Notify.error({
          title: t('error'),
          content: t(
            'You do not have permission to access this resource. please login again.'
          ),
        })
        const pathname = window.location.pathname

        window.location.replace(
          pathname === '/login' ? pathname : `/login?referer=${pathname}`
        )
        return
      }

      if (response.ok && response.status >= 200 && response.status < 400) {
        return data
      }

      const error = formatError(response, data)

      if (typeof reject === 'function') {
        return reject(error, response)
      }

      if (window.onunhandledrejection) {
        window.onunhandledrejection(error)
      }

      return Promise.reject(error)
    })
  }

  if (response.status === 200 || response.status === 204) {
    if (request.headers?.['x-with-headers'] === true) {
      return response
    }
    return response.text()
  }

  return response.text().then(text => {
    const error = formatTextError(response, text)

    if (typeof reject === 'function') {
      return reject(response, error)
    }

    if (window.onunhandledrejection) {
      window.onunhandledrejection(error)
    }

    return Promise.reject(error)
  })
}

function formatError(response, data) {
  if (data.code < 100) {
    data.code = 500
  }

  const result = {
    status: response.status,
    reason: response.statusText,
  }

  if (typeof data.code === 'number') {
    result.status = data.code
  }

  if (typeof data.status === 'number') {
    result.status = data.status
  }

  if (data.reason || data.error) {
    result.reason = data.reason || data.error
  }

  result.message = data.message || data.Error || JSON.stringify(data.details)

  return result
}

function formatTextError(response, text) {
  let error = {
    status: response.status,
    reason: response.statusText,
    message: text,
  }

  const errorBody = safeParseJSON(text)

  if (isObject(errorBody) && !isEmpty(errorBody)) {
    error = {
      ...error,
      code: errorBody.code,
      message: errorBody.message,
      errors: errorBody.errors,
    }
  }

  return error
}
