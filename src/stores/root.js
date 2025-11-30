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

import { get } from 'lodash'
import { action, extendObservable, observable } from 'mobx'
import { RouterStore } from 'mobx-react-router'
import { parse } from 'qs'

import UserStore from 'stores/user'
import WebSocketStore from 'stores/websocket'
import { getQueryString } from 'utils'
import { removeToken } from 'utils/token'
import request from 'utils/request'

export default class RootStore {
  @observable
  navs = globals.config.navs

  @observable
  showGlobalNav = false

  @observable
  actions = {}

  @observable
  oauthServers = []

  constructor() {
    this.websocket = new WebSocketStore()

    this.user = new UserStore()
    this.routing = new RouterStore()
    this.routing.query = this.query

    global.navigateTo = this.routing.push
  }

  register(name, store) {
    extendObservable(this, { [name]: store })
  }

  query = (params = {}, refresh = false) => {
    const { pathname, search } = this.routing.location
    const currentParams = parse(search.slice(1))

    const newParams = refresh ? params : { ...currentParams, ...params }

    this.routing.push(`${pathname}?${getQueryString(newParams)}`)
  }

  @action
  toggleGlobalNav = () => {
    this.showGlobalNav = !this.showGlobalNav
  }

  @action
  hideGlobalNav = () => {
    this.showGlobalNav = false
  }

  @action
  registerActions = actions => {
    extendObservable(this.actions, actions)
  }

  @action
  triggerAction(id, ...rest) {
    this.actions[id] && this.actions[id].on(...rest)
  }

  login(params) {
    // Directly call /oauth/token API (credentials will be injected by server middleware)
    return request.post('oauth/token', params, {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
    })
  }

  loginIdentityProviders(params) {
    const url = `/oauth/login/${params.title}`
    return request.post(url, { ...params })
  }

  @action
  async logout() {
    const res = await request.post('logout')

    // Remove token from localStorage
    removeToken()

    const url = get(res, 'data.url')
    if (url) {
      window.location.href = url
    } else {
      // Redirect to login page
      const pathname = window.location.pathname
      const isAppsRoute = pathname.startsWith('/apps/')
      window.location.href = isAppsRoute ? pathname : '/login'
    }
  }

  @action
  getRules(params) {
    const username = get(globals, 'user.username')
    if (!username) {
      console.warn('User info missing, skip fetching rules')
      return Promise.resolve(null)
    }

    return this.user.fetchRules({ ...params, name: username })
  }
}
