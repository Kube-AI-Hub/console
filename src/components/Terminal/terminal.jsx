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

import React from 'react'
import { debounce } from 'lodash'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import PropTypes from 'prop-types'
import SocketClient from 'utils/socket.client'

import '@xterm/xterm/css/xterm.css'
import './terminal.scss'
import './xterm.scss'

const DEFAULT_TERMINAL_OPTS = {
  lineHeight: 1.2,
  cursorBlink: true,
  cursorStyle: 'underline',
  fontSize: 12,
  fontFamily: "Monaco, Menlo, Consolas, 'Courier New', monospace",
  theme: {
    background: '#181d28', // Always use dark color for terminal background
  },
}

export default class ContainerTerminal extends React.Component {
  static propsTypes = {
    terminalOpts: PropTypes.object,
    websocketUrl: PropTypes.string,
    initText: PropTypes.string,
    isEdgeNode: PropTypes.bool,
  }

  static defaultProps = {
    terminalOpts: {},
    initText: 'Connecting',
    isEdgeNode: false,
  }

  get isWsOpen() {
    return this.ws && this.ws.getSocketState() === 'open'
  }

  constructor(props) {
    super(props)

    this.first = true
    this.containerRef = React.createRef()
    this.initTimer = null
    this.fitAddon = new FitAddon()
    this.resizeDisposable = null
    this.dataDisposable = null
  }

  componentDidMount() {
    this.term = this.initTerm()
    this.ws = this.createWS()

    this.onTerminalResize()
    this.onTerminalKeyPress()

    this.disableTermStdin()
  }

  componentWillUnmount() {
    if (this.resizeDisposable) {
      this.resizeDisposable.dispose()
    }
    if (this.dataDisposable) {
      this.dataDisposable.dispose()
    }
    if (this.term) {
      this.term.dispose()
    }
    this.disconnect()
    this.removeResizeListener()
    this.initTimer && clearInterval(this.initTimer)
  }

  initTerm() {
    const { initText } = this.props
    const terminalOpts = this.getTerminalOpts()
    const term = new Terminal(terminalOpts)
    term.open(this.containerRef.current)
    term.loadAddon(this.fitAddon)
    this.initTimer = this.renderConnecting(term, initText)
    this.fitAddon.fit()

    return term
  }

  renderConnecting(term, initText) {
    let count = 0
    const timer = setInterval(() => {
      term.reset()
      term.write(`${initText}${'.'.repeat(++count)}`)
      if (count > 2) {
        count = 0
      }
    }, 500)
    return timer
  }

  disableTermStdin(disabled = true) {
    const { textarea = {} } = this.term
    textarea.disabled = disabled
  }

  getTerminalOpts() {
    const { terminalOpts } = this.props
    return { ...DEFAULT_TERMINAL_OPTS, ...terminalOpts }
  }

  onTerminalResize() {
    window.addEventListener('resize', this.onResize)
    if (this.term && this.term.onResize) {
      this.resizeDisposable = this.term.onResize(this.resizeRemoteTerminal)
    }
  }

  onTerminalKeyPress() {
    if (this.term && this.term.onData) {
      this.dataDisposable = this.term.onData(this.sendTerminalInput)
    }
  }

  sendTerminalInput = data => {
    if (this.isWsOpen) {
      this.ws.send(this.packStdin(data))
    }
  }

  resizeRemoteTerminal = ({ cols, rows } = {}) => {
    const terminalCols = cols || this.term.cols
    const terminalRows = rows || this.term.rows
    if (this.isWsOpen) {
      this.ws.send(this.packResize(terminalCols, terminalRows))
    }
  }

  removeResizeListener() {
    window.removeEventListener('resize', this.onResize)
  }

  fitTerm = () => this.fitAddon.fit()

  onResize = debounce(this.fitTerm, 800)

  packStdin = data =>
    JSON.stringify({
      Op: 'stdin',
      Data: data,
    })

  packResize = (col, row) =>
    JSON.stringify({
      Op: 'resize',
      Cols: col,
      Rows: row,
    })

  unpackStdout = data => data.Data

  createWS() {
    return new SocketClient(this.props.websocketUrl, {
      onmessage: this.onWSReceive,
      onclose: this.onWSClose,
      onerror: this.onWSError,
      subProtocol: ['binary.k8s.io'],
    })
  }

  onWSError = ex => {
    this.initTimer && clearInterval(this.initTimer)
    this.fatal(ex.message)
  }

  onWSClose = ev => {
    this.initTimer && clearInterval(this.initTimer)
    if (this.first && this.term) {
      const msg = ev.reason || 'Connection closed'
      this.fatal(msg)
    }
  }

  onWSReceive = data => {
    this.initTimer && clearInterval(this.initTimer)
    const term = this.term

    if (data.Op === 'toast') {
      if (this.first && term) {
        this.first = false
        this.fatal(data.Data || 'Connection closed')
      }
      return
    }

    if (this.first) {
      this.first = false
      this.disableTermStdin(false)
      term.reset()
      term.element && term.focus()
      this.resizeRemoteTerminal()
    }

    const stdout = this.unpackStdout(data)
    term.write(stdout)
  }

  disconnect = () => {
    if (this.term) {
      this.disableTermStdin(true)
    }

    if (this.ws) {
      this.ws.close(true)
    }
  }

  fatal = message => {
    const { isEdgeNode } = this.props
    const first = this.first
    if (!message && first)
      message = `Could not connect to the ${
        isEdgeNode ? 'node' : 'container'
      }. Do you have sufficient privileges?`
    if (!message) message = 'disconnected'
    if (!first) message = `\r\n${message}`
    if (first) this.term.reset()
    this.term.write(`\x1b[31m${message}\x1b[m\r\n`)
  }

  render() {
    return (
      <kubernetes-container-terminal
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
        ref={this.containerRef}
      />
    )
  }
}
