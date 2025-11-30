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

import React, { Component } from 'react'
import { inject, observer } from 'mobx-react'
import cookie from 'utils/cookie'
import { setToken, parseToken, getToken } from 'utils/token'
import { loadSessionContext } from 'core/session'

import {
  Alert,
  Button,
  Form,
  Input,
  InputPassword,
} from '@kube-design/components'

import { get } from 'lodash'

import { Base64 } from 'js-base64'
import * as styles from './index.scss'

function encrypt(salt, str) {
  return mix(salt, Base64.encode(str))
}

function mix(salt, str) {
  if (str.length > salt.length) {
    salt += str.slice(0, str.length - salt.length)
  }

  const ret = []
  const prefix = []
  for (let i = 0, len = salt.length; i < len; i++) {
    const tomix = str.length > i ? str.charCodeAt(i) : 64
    const sum = salt.charCodeAt(i) + tomix
    prefix.push(sum % 2 === 0 ? '0' : '1')
    ret.push(String.fromCharCode(Math.floor(sum / 2)))
  }
  return `${Base64.encode(prefix.join(''))}@${ret.join('')}`
}

export default
@inject('rootStore')
@observer
class Login extends Component {
  state = {
    formData: {},
    isSubmmiting: false,
    errorCount: 0,
    showKS: true,
    currentServer: {},
    oauthParams: null,
    isCallingOAuth: false,
  }

  componentDidMount() {
    const params = new URLSearchParams(window.location.search)
    const jwtFromURL = params.get('jwt')
    const clientId = params.get('client_id')
    const redirectUri = params.get('redirect_uri')
    const responseType = params.get('response_type')
    const scope = params.get('scope')
    const state = params.get('state')

    // If JWT is passed via URL parameter (from csghub callback), store it first
    if (jwtFromURL) {
      setToken(jwtFromURL)
      // Clean up URL by removing jwt parameter
      params.delete('jwt')
      const newSearch = params.toString()
      const newURL = newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname
      window.history.replaceState({}, '', newURL)
    }

    if (clientId && redirectUri && responseType) {
      const oauthParams = {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: responseType,
        scope: scope || '',
        state: state || '',
      }
      this.setState({ oauthParams })

      const token = getToken()
      if (token) {
        this.callOAuthAuthorize(oauthParams, token)
      }
    }
  }

  callOAuthAuthorize = (oauthParams, token) => {
    if (!oauthParams || !token) {
      return
    }

    this.setState({ isCallingOAuth: true })

    // Build OAuth authorize URL with token as query parameter
    // The console server will extract the token and set it as Authorization header when proxying to kube-server
    const params = new URLSearchParams({
      client_id: oauthParams.client_id,
      redirect_uri: oauthParams.redirect_uri,
      response_type: oauthParams.response_type,
      token: token, // Pass token via query parameter for console server to extract
    })
    if (oauthParams.scope) {
      params.append('scope', oauthParams.scope)
    }
    if (oauthParams.state) {
      params.append('state', oauthParams.state)
    }

    // Use location.href to handle redirect, allowing browser to handle cross-origin redirects naturally
    window.location.href = `/oauth/authorize?${params.toString()}`
  }

  handleOAuthLogin = server => e => {
    const info = {
      name: server.title,
      type: server.type,
      endSessionURL: server.endSessionURL,
    }
    cookie('oAuthLoginInfo', JSON.stringify(info))
    if (server.type === 'LDAPIdentityProvider') {
      this.setState({
        showKS: false,
        currentServer: server,
      })
    } else {
      window.location.href = e.currentTarget.dataset.url
    }
  }

  navigateAfterLogin = resp => {
    const params = new URLSearchParams(window.location.search)
    const referer = params.get('referer')
    const target = resp.redirectUrl || referer || '/'

    if (this.props.rootStore?.routing?.push) {
      this.props.rootStore.routing.push(target)
    } else {
      window.location.href = target
    }
  }

  // 统一处理所有登录响应
  handleLoginResponse = resp => {
    // Handle OAuth token response (access_token format)
    if (resp && resp.access_token) {
      const accessToken = resp.access_token
      // Parse token to extract user info
      const userInfo = parseToken(accessToken)
      
      if (!userInfo) {
        this.setState({
          isSubmmiting: false,
          errorMessage: 'FAILED_TO_PARSE_TOKEN',
          errorCount: 0,
        })
        return
      }

      // 登录成功 - 存储 token
      setToken(accessToken)

      // 处理特殊情况：需要确认注册
      if (userInfo.username === 'system:pre-registration') {
        if (userInfo.extraname) {
          sessionStorage.setItem('defaultUser', userInfo.extraname)
        }
        if (userInfo.email) {
          sessionStorage.setItem('defaultEmail', userInfo.email)
        }
        window.location.href = '/login/confirm'
        return
      }

      // 处理特殊情况：需要修改密码
      if (!userInfo.initialized) {
        window.location.href = '/password/confirm'
        return
      }
        
      // 检查是否有 OAuth 参数需要继续授权流程
      if (this.state.oauthParams) {
        this.callOAuthAuthorize(this.state.oauthParams, accessToken)
        return
      }
        
      // 正常登录成功，先加载会话上下文，再跳转
      loadSessionContext()
        .then(() => {
          this.setState({ isSubmmiting: false })
          this.navigateAfterLogin({})
        })
        .catch(err => {
          console.error('Failed to load session context:', err)
          this.setState({
            isSubmmiting: false,
            errorMessage: err.message || 'FAILED_TO_LOAD_SESSION_CONTEXT',
            errorCount: 0,
          })
        })
      return
    }

    // Handle legacy response format (for backward compatibility)
    if (resp && resp.token) {
      setToken(resp.token)

      if (resp.needConfirm) {
        if (resp.defaultUser) {
          sessionStorage.setItem('defaultUser', resp.defaultUser)
        }
        if (resp.defaultEmail) {
          sessionStorage.setItem('defaultEmail', resp.defaultEmail)
        }
        window.location.href = resp.confirmUrl || '/login/confirm'
        return
      }

      if (resp.needPasswordChange) {
        window.location.href = resp.passwordChangeUrl || '/password/confirm'
        return
      }

      // 检查是否有 OAuth 参数需要继续授权流程
      if (this.state.oauthParams) {
        this.callOAuthAuthorize(this.state.oauthParams, resp.token)
        return
      }
        
      loadSessionContext()
        .then(() => {
          this.setState({ isSubmmiting: false })
          this.navigateAfterLogin(resp)
        })
        .catch(err => {
          console.error('Failed to load session context:', err)
          this.setState({
            isSubmmiting: false,
            errorMessage: err.message || 'FAILED_TO_LOAD_SESSION_CONTEXT',
            errorCount: 0,
          })
        })
      return
    }

    // 登录失败
    this.setState({
      isSubmmiting: false,
      errorMessage: resp?.error_description || resp?.message || resp?.error || 'LOGIN_FAILED',
      errorCount: resp?.errorCount || 0,
    })
  }

  handleSubmit = (data, event) => {
    // 阻止表单默认提交行为
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }

    const { username, password, ...rest } = data
    const { showKS, currentServer } = this.state
    
    // 清空之前的错误信息
    this.setState({ 
      isSubmmiting: true,
      errorMessage: '',
      errorCount: 0,
    })

    cookie('oAuthLoginInfo', '')

    const encryptKey = get(globals, 'config.encryptKey', 'kubesphere')

    if (!showKS) {
      // 第三方登录 - 纯 AJAX 请求
      this.props.rootStore
        .loginIdentityProviders({
          username,
          password,
          title: currentServer.title,
        })
        .then(resp => this.handleLoginResponse(resp))
        .catch(err => {
          console.error('Login error:', err)
          this.setState({
            isSubmmiting: false,
            errorMessage: err.message || 'LOGIN_FAILED',
            errorCount: 0,
          })
        })
    } else {
      // 普通登录 - 直接调用 /oauth/token API
      this.props.rootStore
        .login({
          username,
          password: encrypt(encryptKey, password),
          grant_type: 'password',
        })
        .then(resp => this.handleLoginResponse(resp))
        .catch(err => {
          console.error('Login error:', err)
          this.setState({
            isSubmmiting: false,
            errorMessage: err.message || err.error_description || err.error || 'LOGIN_FAILED',
            errorCount: 0,
          })
        })
    }
  }

  handleBack = () => {
    this.setState({
      showKS: true,
      currentServer: {},
      errorMessage: '',
      errorCount: 0,
    })
  }

  render() {
    const {
      formData,
      isSubmmiting,
      errorMessage,
      showKS,
      currentServer,
      isCallingOAuth,
    } = this.state

    if (isCallingOAuth) {
      return (
        <div className={styles.loginContainer}>
          <div className={styles.login}>
            <div className={styles.header}>{t('AUTHORIZING')}</div>
            <div className={styles.divider}></div>
            <div style={{ textAlign: 'center', padding: '20px' }}>
              {t('AUTHORIZING_DESC')}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className={styles.loginContainer}>
        <div className={styles.login}>
          <div className={styles.header}>
            {showKS
              ? t('WELCOME')
              : t('TITLE_USERNAME', { title: currentServer.title })}
          </div>
          <div className={styles.divider}></div>
          {showKS &&
            get(globals, 'oauthServers', []).map(server => (
              <div
                key={server.url}
                className={styles.oauth}
                data-url={server.url}
                onClick={this.handleOAuthLogin(server)}
              >
                <span>{t('LOG_IN_WITH_TITLE', { title: server.title })}</span>
              </div>
            ))}
          {errorMessage && (
            <Alert
              className="margin-t12 margin-b12"
              type="error"
              message={t(errorMessage)}
            />
          )}
          <Form data={formData} onSubmit={this.handleSubmit}>
            <Form.Item
              label={
                showKS
                  ? t('USERNAME_OR_EMAIL')
                  : t('TITLE_USERNAME', { title: currentServer.title })
              }
              rules={[
                {
                  required: true,
                  message: t('INPUT_USERNAME_OR_EMAIL_TIP'),
                },
              ]}
            >
              <Input name="username" placeholder="user@example.com" />
            </Form.Item>
            <Form.Item
              label={t('PASSWORD')}
              rules={[{ required: true, message: t('PASSWORD_EMPTY_DESC') }]}
            >
              <InputPassword
                name="password"
                placeholder=" "
                autoComplete="new-password"
              />
            </Form.Item>
            <div className={styles.footer}>
              <Button type="control" htmlType="submit" loading={isSubmmiting}>
                {t('LOG_IN')}
              </Button>
              {!showKS && (
                <p className={styles.back} onClick={this.handleBack}>
                  {t('BACK')}
                </p>
              )}
            </div>
          </Form>
        </div>
      </div>
    )
  }
}
