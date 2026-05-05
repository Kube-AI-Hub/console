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
import { get, omit } from 'lodash'
import { Form } from '@kube-design/components'
import Base from 'components/Forms/Workload/ContainerSettings'
import { resolveGpuCardTypeFromResourceKeys } from 'utils'

export default class PodTemplate extends Base {
  get formTemplate() {
    return this.props.formTemplate
  }

  handleContainer = data => {
    const { formProps } = this.props
    Base.prototype.handleContainer.call(this, data)
    formProps.onChange()
  }

  render() {
    const { formRef, formProps, isFederated, isEdit } = this.props
    const { showContainer, selectContainer } = this.state

    const data =
      isFederated && isEdit ? this.fedFormTemplate : this.formTemplate

    const annotationOfImagePullSecrets = JSON.parse(
      get(
        data,
        'spec.template.metadata.annotations["kubesphere.io/imagepullsecrets"]',
        '{}'
      )
    )

    if (showContainer) {
      return this.renderContainerForm({
        ...selectContainer,
        annotationOfImagePullSecrets,
      })
    }

    const containers = get(data, 'spec.template.spec.containers', [])
    containers.forEach(item => {
      const requests = get(item, 'resources.requests', {})
      const limits = get(item, 'resources.limits', {})
      const reqGpu = omit(requests, ['cpu', 'memory'])
      const limGpu = omit(limits, ['cpu', 'memory'])
      const keySet = new Set([
        ...Object.keys(reqGpu),
        ...Object.keys(limGpu),
      ])
      if (keySet.size === 0) {
        return
      }
      const type = resolveGpuCardTypeFromResourceKeys(keySet)
      if (!type) {
        return
      }
      item.resources.gpu = {
        type,
        value: reqGpu[type] ?? limGpu[type] ?? '',
      }
    })

    return (
      <Form data={data} ref={formRef} {...formProps}>
        {this.renderContainerList()}
      </Form>
    )
  }
}
