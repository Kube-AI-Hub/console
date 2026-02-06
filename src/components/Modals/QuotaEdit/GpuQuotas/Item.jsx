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

import { Select } from '@kube-design/components'
import { ObjectInput, NumberInput } from 'components/Inputs'
import { getGpuTypeOptions } from 'utils'

export default class GpuQuotaItem extends React.Component {
  get gpuOptions() {
    return getGpuTypeOptions()
  }

  handleChange = item => {
    this.props.onChange(item)
  }

  render() {
    const { value } = this.props

    return (
      <ObjectInput value={value} onChange={this.handleChange}>
        <Select
          name="type"
          options={this.gpuOptions}
          searchable={false}
          placeholder={t('SELECT_RESOURCE_TIP')}
        />
        <NumberInput
          name="quota"
          className="margin-l12"
          placeholder={t('QUOTA')}
          integer
          min={0}
        />
      </ObjectInput>
    )
  }
}
