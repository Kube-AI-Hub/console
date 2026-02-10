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
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react'
import PropTypes from 'prop-types'
import { get } from 'lodash'

import { Alert, Form, Select, Input, Notify } from '@kube-design/components'
import { Modal } from 'components/Base'
import request from 'utils/request'
import { getVendorModeConfig, getParamsForMode, getModeOption } from './config'

function buildFormData(nodeInfo, vendorConfig) {
  const mode = nodeInfo.virtualCardMode || 'default'
  const existingParams = nodeInfo.gpuModeParams || {}
  const formData = { mode }
  const params = getParamsForMode(vendorConfig, mode)
  params.forEach(p => {
    const existing = existingParams[p.key]
    if (existing !== undefined && existing !== '') {
      formData[p.key] =
        p.type === 'number'
          ? Number(existing)
          : p.type === 'boolean'
          ? existing === 'true'
          : existing
    } else {
      formData[p.key] = p.default
    }
  })
  return formData
}

function buildParamsFromFormData(data, vendorConfig) {
  const params = {}
  const modeParams = getParamsForMode(vendorConfig, data.mode || 'default')
  modeParams.forEach(p => {
    const v = data[p.key]
    if (v === undefined || v === '') return
    if (p.type === 'boolean') {
      params[p.key] = v ? 'true' : 'false'
    } else {
      params[p.key] = String(v)
    }
  })
  return params
}

export default class GpuVirtModeModal extends React.Component {
  static propTypes = {
    detail: PropTypes.object,
    visible: PropTypes.bool,
    onOk: PropTypes.func,
    onCancel: PropTypes.func,
  }

  static defaultProps = {
    visible: false,
    onOk() {},
    onCancel() {},
  }

  constructor(props) {
    super(props)
    const nodeInfo =
      get(props.detail, 'status.nodeInfo') ||
      get(props.detail, 'nodeInfo') ||
      {}
    const gpuVendor = (nodeInfo.gpuVendor || '').toLowerCase()
    const vendorConfig = getVendorModeConfig(gpuVendor)
    this.state = {
      formData: buildFormData(nodeInfo, vendorConfig),
      isSubmitting: false,
    }
  }

  componentDidUpdate(prevProps) {
    const { visible, detail } = this.props
    if (visible && visible !== prevProps.visible && detail) {
      const nodeInfo =
        get(detail, 'status.nodeInfo') || get(detail, 'nodeInfo') || {}
      const gpuVendor = (nodeInfo.gpuVendor || '').toLowerCase()
      const vendorConfig = getVendorModeConfig(gpuVendor)
      this.setState({
        formData: buildFormData(nodeInfo, vendorConfig),
      })
    }
  }

  handleSubmit = async data => {
    const { detail, onOk } = this.props
    const nodeName = detail.name
    const nodeInfo =
      get(detail, 'status.nodeInfo') || get(detail, 'nodeInfo') || {}
    const vendorConfig = getVendorModeConfig(
      (nodeInfo.gpuVendor || '').toLowerCase()
    )
    this.setState({ isSubmitting: true })
    try {
      const params = buildParamsFromFormData(data, vendorConfig)
      await request.put(
        `/kapis/gpu.kubesphere.io/v1alpha1/device-plugins/gpu/mode?nodeName=${nodeName}`,
        { mode: data.mode || 'default', params }
      )
      Notify.success({ content: t('UPDATE_SUCCESSFUL') })
      onOk()
    } catch (err) {
      Notify.error({
        content: err.message || t('UPDATE_FAILED'),
      })
    } finally {
      this.setState({ isSubmitting: false })
    }
  }

  handleModeChange = mode => {
    const { detail } = this.props
    const nodeInfo =
      get(detail, 'status.nodeInfo') || get(detail, 'nodeInfo') || {}
    const vendorConfig = getVendorModeConfig(
      (nodeInfo.gpuVendor || '').toLowerCase()
    )
    if (!vendorConfig || !vendorConfig.modeOptions) return
    const modeOpt = vendorConfig.modeOptions.find(o => o.value === mode)
    const newParams = {}
    if (modeOpt && modeOpt.params) {
      modeOpt.params.forEach(p => {
        newParams[p.key] = p.default
      })
    }
    this.setState(prev => ({
      formData: { ...prev.formData, mode, ...newParams },
    }))
  }

  render() {
    const { detail, onOk, ...rest } = this.props
    const { formData, isSubmitting } = this.state
    const nodeInfo =
      get(detail, 'status.nodeInfo') || get(detail, 'nodeInfo') || {}
    const gpuVendor = (nodeInfo.gpuVendor || '').toLowerCase()
    const vendorConfig = getVendorModeConfig(gpuVendor)
    const supported =
      vendorConfig &&
      vendorConfig.modeOptions &&
      vendorConfig.modeOptions.length > 0
    const modeOptions = supported
      ? vendorConfig.modeOptions.map(opt => ({
          label: t(opt.labelKey),
          value: opt.value,
        }))
      : []
    const currentMode = formData.mode || 'default'
    const modeParams = getParamsForMode(vendorConfig, currentMode)
    const currentModeOption = getModeOption(vendorConfig, currentMode)
    const modeDesc =
      currentModeOption && currentModeOption.descKey
        ? t(currentModeOption.descKey)
        : null

    return (
      <Modal.Form
        width={560}
        title={t('SET_VGPU_MODE')}
        icon="cog"
        okText={t('OK')}
        data={formData}
        onOk={this.handleSubmit}
        isSubmitting={isSubmitting}
        hideFooter={!supported}
        {...rest}
      >
        <Alert type="info" message={t('SET_VGPU_MODE_DESC')} />
        {!supported ? (
          <Alert type="warning" message={t('VGPU_MODE_VENDOR_NOT_SUPPORTED')} />
        ) : (
          <>
            <Form.Item label={t('GPU_MODE')} rules={[{ required: true }]}>
              <Select
                name="mode"
                options={modeOptions}
                onChange={this.handleModeChange}
              />
            </Form.Item>
            {modeDesc ? (
              <Alert
                type="info"
                message={modeDesc}
                style={{ marginBottom: 16 }}
              />
            ) : null}
            {modeParams.length > 0
              ? modeParams.map(p => {
                  if (p.type === 'number') {
                    return (
                      <Form.Item
                        key={p.key}
                        label={t(p.labelKey)}
                        desc={p.descKey ? t(p.descKey) : undefined}
                      >
                        <Input name={p.key} type="number" min={0} />
                      </Form.Item>
                    )
                  }
                  if (p.type === 'select' && p.options) {
                    return (
                      <Form.Item
                        key={p.key}
                        label={t(p.labelKey)}
                        desc={p.descKey ? t(p.descKey) : undefined}
                      >
                        <Select
                          name={p.key}
                          options={p.options.map(o => ({
                            label: t(o.labelKey),
                            value: o.value,
                          }))}
                        />
                      </Form.Item>
                    )
                  }
                  if (p.type === 'boolean') {
                    return (
                      <Form.Item
                        key={p.key}
                        label={t(p.labelKey)}
                        desc={p.descKey ? t(p.descKey) : undefined}
                      >
                        <Select
                          name={p.key}
                          options={[
                            { label: t('YES'), value: true },
                            { label: t('NO'), value: false },
                          ]}
                        />
                      </Form.Item>
                    )
                  }
                  return null
                })
              : null}
          </>
        )}
      </Modal.Form>
    )
  }
}
