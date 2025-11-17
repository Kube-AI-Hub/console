/* eslint-disable import/no-import-module-exports */
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

import React, { Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { LocaleProvider, Loading, Notify } from '@kube-design/components'

import request from 'utils/request'

import TerminalApp from 'pages/terminal'
import GlobalValue from './global'
import i18n from './i18n'

import '@kube-design/components/esm/styles/index.scss'
import 'scss/main.scss'

import 'core-js/stable'

// request error handler
window.onunhandledrejection = function(e) {
  if (e && (e.status === 'Failure' || e.status >= 400)) {
    Notify.error({ title: e.reason, content: t(e.message), duration: 6000 })
  }
}

window.t = i18n.t
window.request = request

globals.app = new GlobalValue()
const container = document.getElementById('root')
if (!container) {
  throw new Error('Root container #root not found')
}
const root = createRoot(container)

let localesPromise
const ensureLocales = () => {
  if (!localesPromise) {
    localesPromise = i18n.init().then(({ locales }) => locales)
  }
  return localesPromise
}

const render = async component => {
  const locales = await ensureLocales()
  root.render(
    <Suspense fallback={<Loading className="ks-page-loading" />}>
      <LocaleProvider locales={locales} localeKey="lang" ignoreWarnings>
        {component}
      </LocaleProvider>
    </Suspense>
  )
}

render(<TerminalApp />)

module.hot &&
  module.hot.accept('../pages/terminal', () => {
    const NextApp = require('../pages/terminal').default
    render(<NextApp />)
  })
