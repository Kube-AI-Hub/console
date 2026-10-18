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
import PropTypes from 'prop-types'

import { Alert, Form, Input } from '@kube-design/components'
import { Modal } from 'components/Base'

import { formatBytes, usagePercent } from '../../utils'

import * as styles from './index.scss'

// Kubernetes quantity, e.g. 8Ti or 512Gi. The value goes to the apiserver as-is.
const QUANTITY_RE = /^\d+(\.\d+)?(Ki|Mi|Gi|Ti|Pi|K|M|G|T|P)?$/

// Units offered in the form, with the multiplier to bytes.
const UNITS = [
  { label: 'GiB', value: 'Gi', factor: 1024 ** 3 },
  { label: 'TiB', value: 'Ti', factor: 1024 ** 4 },
]

/**
 * Quota form.
 *
 * Only the number and the unit are asked for: everything else (patching the PV,
 * running the job that applies the directory quota) is the API's job, and the API
 * refuses a value below what the volume already holds.
 */
export default class QuotaModal extends Component {
  static propTypes = {
    volume: PropTypes.object,
    visible: PropTypes.bool,
    submitting: PropTypes.bool,
    error: PropTypes.string,
    onOk: PropTypes.func,
    onCancel: PropTypes.func,
  }

  static defaultProps = {
    volume: {},
    visible: false,
    submitting: false,
    error: '',
    onOk: () => {},
    onCancel: () => {},
  }

  constructor(props) {
    super(props)
    this.state = this.initialState(props)
  }

  componentDidUpdate(prev) {
    // Reopening for another volume must not keep the previous number.
    if (prev.volume !== this.props.volume && this.props.volume) {
      this.setState(this.initialState(this.props))
    }
  }

  initialState = props => {
    const volume = props.volume || {}
    const capacity = Number(volume.capacityBytes) || 0
    const unit = capacity >= 1024 ** 4 ? 'Ti' : 'Gi'
    const factor = unit === 'Ti' ? 1024 ** 4 : 1024 ** 3

    return {
      value: capacity > 0 ? String(Math.round(capacity / factor)) : '1',
      unit,
      initialBytes: capacity,
    }
  }

  get factor() {
    const unit = UNITS.find(item => item.value === this.state.unit)
    return unit ? unit.factor : 1024 ** 3
  }

  get capacityBytes() {
    const value = parseFloat(this.state.value)
    if (!value || value <= 0) return 0
    return Math.round(value * this.factor)
  }

  get quantity() {
    return `${this.state.value}${this.state.unit}`
  }

  get usedBytes() {
    return Number(this.props.volume.usedBytes) || 0
  }

  get validationError() {
    const { value } = this.state
    if (!value || !QUANTITY_RE.test(`${value}${this.state.unit}`)) {
      return t('SHARED_STORAGE_QUOTA_INVALID')
    }
    if (this.capacityBytes <= this.usedBytes) {
      return t('SHARED_STORAGE_QUOTA_BELOW_USAGE', {
        used: formatBytes(this.usedBytes),
      })
    }
    return ''
  }

  // The Input's onChange signature is (event, value), not the value alone.
  handleValueChange = (_, value) => this.setState({ value })

  handleUnitChange = unit => this.setState({ unit })

  handleOk = () => {
    if (this.validationError) return
    this.props.onOk(this.quantity)
  }

  render() {
    const { visible, submitting, error, onCancel, volume } = this.props
    const { value, unit } = this.state
    const percent = usagePercent(volume.usedBytes, volume.capacityBytes)

    return (
      <Modal
        title={t('SHARED_STORAGE_SET_QUOTA')}
        visible={visible}
        okText={t('OK')}
        cancelText={t('CANCEL')}
        onOk={this.handleOk}
        onCancel={onCancel}
        confirmLoading={submitting}
        disableOk={!!this.validationError || submitting}
        width={560}
      >
        <div className={styles.body}>
          <div className={styles.meta}>
            <div>
              <span className={styles.label}>
                {t('SHARED_STORAGE_DIRECTORY')}
              </span>
              <span className={styles.mono}>{volume.path}</span>
            </div>
            <div>
              <span className={styles.label}>{t('SHARED_STORAGE_USED')}</span>
              <span>
                {formatBytes(this.usedBytes)} ({percent.toFixed(1)}%)
              </span>
            </div>
            <div>
              <span className={styles.label}>
                {t('SHARED_STORAGE_CAPACITY')}
              </span>
              <span>{formatBytes(volume.capacityBytes)}</span>
            </div>
          </div>

          <Form.Item label={t('SHARED_STORAGE_NEW_CAPACITY')}>
            <Input
              name="capacity"
              value={value}
              onChange={this.handleValueChange}
              addonAfter={
                <select
                  className={styles.unit}
                  value={unit}
                  onChange={e => this.handleUnitChange(e.target.value)}
                >
                  {UNITS.map(item => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              }
            />
          </Form.Item>

          {this.validationError ? (
            <Alert type="error" message={this.validationError} />
          ) : null}
          {error ? <Alert type="error" message={error} /> : null}

          <Alert
            type="info"
            message={t('SHARED_STORAGE_QUOTA_HINT', {
              path: volume.path,
            })}
          />
        </div>
      </Modal>
    )
  }
}
