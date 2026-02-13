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

import { getClusterUrl, safeParseJSON } from './index'
import { getToken, removeToken } from './token'

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
      if (response.status === 401) {
        console.warn('Unauthorized', response, response.ok)

        // 检查是否是登录相关的请求 - 这些请求的 401 是正常的业务错误，不应该触发会话超时处理
        const isLoginRequest =
          request.url &&
          (request.url.includes('/login') || request.url.startsWith('/oauth/'))

        // 只有非登录请求的 401 才是真正的会话超时
        if (!isLoginRequest) {
          // Remove token and redirect to login
          removeToken()
          const pathname = window.location.pathname
          if (pathname !== '/login') {
            window.location.replace(`/login?referer=${pathname}`)
          }
        }

        // 返回错误信息给调用者处理，同时标记来源便于全局错误处理识别
        // 对于 OAuth 错误，将 error_description 映射到友好的 i18n key
        let message = data.message || 'Please login again'
        if (isLoginRequest && data.error === 'invalid_grant') {
          const errorDesc = (data.error_description || '').toLowerCase()
          if (
            errorDesc.includes('incorrect password') ||
            errorDesc.includes('password')
          ) {
            message = 'INCORRECT_PASSWORD'
          } else if (
            errorDesc.includes('user not found') ||
            errorDesc.includes('user does not exist')
          ) {
            message = 'USER_NOT_FOUND'
          } else {
            message = 'INCORRECT_USERNAME_OR_PASSWORD'
          }
        }

        const loginError = {
          status: 401,
          reason: data.reason || 'Unauthorized',
          message,
          error: data.error,
          error_description: data.error_description,
        }
        if (isLoginRequest) {
          loginError.source = 'login'
        }
        return Promise.reject(loginError)
      }

      // 处理 OAuth 登录 400 错误（如密码错误）
      if (response.status === 400) {
        const isLoginRequest =
          request.url &&
          (request.url.includes('/login') || request.url.startsWith('/oauth/'))

        if (isLoginRequest && data.error === 'invalid_grant') {
          const errorDesc = (data.error_description || '').toLowerCase()
          let message = 'INCORRECT_USERNAME_OR_PASSWORD'

          if (
            errorDesc.includes('incorrect password') ||
            errorDesc.includes('password')
          ) {
            message = 'INCORRECT_PASSWORD'
          } else if (
            errorDesc.includes('user not found') ||
            errorDesc.includes('user does not exist')
          ) {
            message = 'USER_NOT_FOUND'
          }

          const loginError = {
            status: 400,
            reason: data.error,
            message,
            error: data.error,
            error_description: data.error_description,
            source: 'login',
          }
          return Promise.reject(loginError)
        }
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
