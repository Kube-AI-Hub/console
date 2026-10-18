/*
 * This file is part of Kube AI Hub.
 *
 * Copyright 2026 Kube AI Hub.
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
import { mount } from 'enzyme'
import { Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'

import RankingTable from './index'

// The ranking rows carry the project name in `namespace` and nothing else that
// identifies them, so the table must key rows by that field. Without a rowKey the
// Table falls back to "name", which no rank row has: every row then shares the
// key `undefined`, React reuses the previous rows' DOM (and the Avatar's memoised
// label) in place, and after a re-sort the project name no longer matches its
// link.
const projectColumns = [
  {
    dataIndex: 'namespace',
    title: 'PROJECT',
    render: namespace => (
      <a href={`/clusters/default/projects/${namespace}`}>{namespace}</a>
    ),
  },
]

const mountTable = dataSource =>
  mount(
    <Router history={createMemoryHistory()}>
      <RankingTable
        columns={projectColumns}
        store={{ sort_metric: 'namespace_cpu_usage' }}
        dataSource={dataSource}
      />
    </Router>
  )

const readRows = wrapper =>
  wrapper.find('tbody tr').map(row => {
    const anchor = row.find('a').first()
    return {
      text: anchor.text(),
      href: anchor.prop('href'),
    }
  })

it('keys rank rows by the field the ranking rows actually have', () => {
  // Two different orderings of the same projects. `name` is absent from both, so
  // a "name" rowKey gives every row the same key and React keeps the old DOM.
  const byCpu = [
    { namespace: 'cert-manager', namespace_cpu_usage: '0.071' },
    { namespace: 'envoy-gateway-system', namespace_cpu_usage: '0.049' },
  ]
  const byMemory = [
    { namespace: 'envoy-gateway-system', namespace_cpu_usage: '0.049' },
    { namespace: 'cert-manager', namespace_cpu_usage: '0.071' },
  ]

  const wrapper = mountTable(byCpu)
  expect(readRows(wrapper)).toEqual([
    { text: 'cert-manager', href: '/clusters/default/projects/cert-manager' },
    {
      text: 'envoy-gateway-system',
      href: '/clusters/default/projects/envoy-gateway-system',
    },
  ])

  wrapper.setProps({})
  wrapper
    .find('RankingTable')
    .first()
    .setProps({ dataSource: byMemory })
    .update()

  // Every rendered row must still pair the project name with its own link.
  readRows(wrapper).forEach(({ text, href }) => {
    expect(href).toBe(`/clusters/default/projects/${text}`)
  })
})
