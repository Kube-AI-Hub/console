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
import { Loading } from '@kube-design/components'
import Modal from 'components/Modals/ContianerTerminal'
import KubeModal from 'components/Modals/KubeCtl'
import { ensureSessionContext } from 'core/session'

class TerminalApp extends Component {
  state = {
    ready: false,
  }

  componentDidMount() {
    ensureSessionContext()
      .then(context => {
        if (!context && !globals.user) {
          this.redirectToLogin()
          return
        }
        this.setState({ ready: true })
      })
      .catch(() => {
        this.redirectToLogin()
      })
  }

  pageClose() {
    window.opener = null
    window.open('', '_self', '')
    window.close()
  }

  redirectToLogin() {
    const referer = encodeURIComponent(
      `${window.location.pathname}${window.location.search || ''}`
    )
    window.location.replace(`/login?referer=${referer}`)
  }

  renderTerminalContent() {
    const pathSplit = window.location.pathname.split('/')
    const isKubeCtrl = pathSplit[2] === 'kubectl'
    const isNode = pathSplit[2] === 'nodename'
    const match = {
      params: {
        containerName: pathSplit[9],
        cluster: pathSplit[3],
        namespace: pathSplit[5],
        podName: pathSplit[7],
      },
    }

    if (isKubeCtrl) {
      return (
        <KubeModal
          onCancel={this.pageClose}
          title="kubectl"
          cluster={pathSplit[3]}
        />
      )
    }

    if (isNode) {
      return (
        <KubeModal
          onCancel={this.pageClose}
          title={pathSplit[3]}
          nodename={pathSplit[3]}
        />
      )
    }

    return <Modal onCancel={this.pageClose} match={match} title="terminal" />
  }

  render() {
    if (!this.state.ready) {
      return (
        <div
          style={{
            width: '100%',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Loading />
        </div>
      )
    }

    return this.renderTerminalContent()
  }
}

export default TerminalApp
