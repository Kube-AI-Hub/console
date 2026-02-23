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

import React, { Component } from 'react'
import { observer } from 'mobx-react'
import { pick } from 'lodash'
import { Icon, Select } from '@kube-design/components'

import * as styles from './index.scss'

export default
@observer
class NodeSelect extends Component {
  getNodes() {
    return [
      ...this.props.list.data.map(item => ({
        label:
          item.ip && item.ip !== '-' ? `${item.name} (${item.ip})` : item.name,
        value: item.name,
      })),
    ]
  }

  optionRenderer = option => (
    <span className={styles.option}>
      <Icon name="nodes" type="light" />
      {option.label}
    </span>
  )

  render() {
    const { value, list, onChange, onFetch } = this.props

    const pagination = pick(list, ['page', 'total', 'limit'])

    return (
      <Select
        className={styles.select}
        value={value}
        onChange={onChange}
        options={this.getNodes()}
        placeholder={t('ALL_NODES')}
        pagination={pagination}
        isLoading={list.isLoading}
        valueRenderer={this.optionRenderer}
        optionRenderer={this.optionRenderer}
        onFetch={onFetch}
        searchable
        clearable
      />
    )
  }
}
