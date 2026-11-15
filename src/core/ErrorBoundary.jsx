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
 * See the License for the applicable language governing permissions and
 * limitations under the License.
 */

import React from 'react'

export default class ErrorBoundary extends React.Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Keep the last render error where CDP / support can read it.
    window.__renderError = {
      message: error && error.message,
      stack: error && error.stack,
      componentStack: info && info.componentStack,
    }
    // eslint-disable-next-line no-console
    console.error('UI render failed', error, info)
  }

  render() {
    const { error } = this.state
    if (!error) {
      return this.props.children
    }

    if (this.props.fallback === null) {
      return null
    }
    if (this.props.fallback) {
      return this.props.fallback
    }

    return (
      <div
        data-test="render-error"
        style={{
          padding: 24,
          color: '#fff',
          maxWidth: 720,
        }}
      >
        <h2 style={{ marginBottom: 8 }}>页面无法显示</h2>
        <p style={{ opacity: 0.85 }}>{error.message || String(error)}</p>
      </div>
    )
  }
}
