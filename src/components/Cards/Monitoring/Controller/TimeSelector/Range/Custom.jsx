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
import PropTypes from 'prop-types'
import classnames from 'classnames'

import {
  Button,
  Form,
  Notify,
  DatePicker,
  Select,
} from '@kube-design/components'

import {
  MONITORING_MAX_POINTS,
  getAdaptedStep,
  secondsToStepStr,
  stepStrToSeconds,
} from 'utils/monitoring'
import { getMinutes, getTimeOptions } from '../utils'

import * as styles from './index.scss'

const TimeOps = ['1m', '2m', '5m', '10m', '15m', '30m', '1h', '2h', '5h']

export default class CustomRange extends React.Component {
  static propTypes = {
    showStep: PropTypes.bool,
    step: PropTypes.string,
    times: PropTypes.number,
    start: PropTypes.instanceOf(Date),
    end: PropTypes.instanceOf(Date),
    onSubmit: PropTypes.func,
    onCancel: PropTypes.func,
  }

  static defaultProps = {
    showStep: true,
    step: '10m',
    times: 30,
    onSubmit() {},
    onCancel() {},
  }

  constructor(props) {
    super(props)

    const now = new Date()
    const defaultStart = new Date(now.valueOf() - 3600000)
    const startDate =
      props.start && props.start instanceof Date ? props.start : defaultStart
    const endDate = props.end && props.end instanceof Date ? props.end : now

    this.formData = {
      step: this.normalizeStep(props.step),
      start: [startDate],
      end: [endDate],
    }
  }

  normalizeStep(step) {
    const stepSec = stepStrToSeconds(step)
    if (!stepSec) return '1m'
    return secondsToStepStr(stepSec)
  }

  getStepOptions = () => {
    const { start, end } = this.formData
    const startDate = start && start[0]
    const endDate = end && end[0]
    const intervalSec =
      startDate instanceof Date && endDate instanceof Date
        ? (endDate.valueOf() - startDate.valueOf()) / 1000
        : 0
    return getTimeOptions(TimeOps).map(option => {
      const stepSec = stepStrToSeconds(option.value)
      const disabled =
        intervalSec > 0 && stepSec > 0
          ? intervalSec / stepSec > MONITORING_MAX_POINTS
          : false
      return { ...option, disabled }
    })
  }

  ensureAvailableStep = () => {
    const options = this.getStepOptions()
    const current = this.formData.step
    const currentOption = options.find(option => option.value === current)
    if (currentOption && !currentOption.disabled) return
    const fallback = options.find(option => !option.disabled)
    if (fallback) this.formData.step = fallback.value
  }

  componentDidUpdate(prevProps) {
    const { start, end, step } = this.props
    const prevStart =
      prevProps.start && prevProps.start.getTime
        ? prevProps.start.getTime()
        : null
    const prevEnd =
      prevProps.end && prevProps.end.getTime ? prevProps.end.getTime() : null
    const nextStart = start && start.getTime ? start.getTime() : null
    const nextEnd = end && end.getTime ? end.getTime() : null
    const prevStep = prevProps.step
    const nextStep = step
    if (
      prevStart !== nextStart ||
      prevEnd !== nextEnd ||
      prevStep !== nextStep
    ) {
      if (start && start instanceof Date) this.formData.start = [start]
      if (end && end instanceof Date) this.formData.end = [end]
      if (nextStep) this.formData.step = this.normalizeStep(nextStep)
      this.ensureAvailableStep()
      this.forceUpdate()
    }
  }

  handlerStartDateClose = this.handlerDateClose('start')

  handlerEndDateClose = this.handlerDateClose('end')

  handlerDateClose(name) {
    return time => {
      this.formData[name] = time
      this.ensureAvailableStep()
      this.forceUpdate()
    }
  }

  handleOk = () => {
    const { step, start, end } = this.formData
    if (!start[0] || !end[0]) {
      Notify.error({ content: t('TIMERANGE_SELECTOR_ERROR_MSG') })
      return
    }
    const startTime = start[0].valueOf() / 1000
    const endTime = end[0].valueOf() / 1000
    const interval = endTime - startTime

    if (interval > 0) {
      const adaptedStep = getAdaptedStep(startTime, endTime, step)
      const times = Math.floor(interval / (getMinutes(adaptedStep) * 60)) || 1
      const data = {
        step: adaptedStep,
        times,
        start: startTime,
        end: endTime,
        lastTime: '',
      }
      this.props.onSubmit(data)
    } else {
      Notify.error({ content: t('TIMERANGE_SELECTOR_MSG') })
    }
  }

  render() {
    const { onCancel, className } = this.props
    const { step, start, end } = this.formData
    const stepOptions = this.getStepOptions()

    return (
      <div className={classnames(styles.custom, className)}>
        <div className={styles.title}>{t('CUSTOM_TIME_RANGE')}</div>
        <Form data={this.formData}>
          <Form.Item label={t('START_TIME')}>
            <DatePicker
              name="start"
              defaultDate={start[0]}
              maxDate={end[0]}
              enableTime
              enableSeconds
              dateFormat={'Y-m-d H:i:S'}
              onClose={this.handlerStartDateClose}
            />
          </Form.Item>
          <Form.Item label={t('END_TIME')}>
            <DatePicker
              name="end"
              defaultDate={end[0]}
              maxDate={end[0]}
              enableTime
              enableSeconds
              dateFormat={'Y-m-d H:i:S'}
              onClose={this.handlerEndDateClose}
            />
          </Form.Item>
          {this.props.showStep && (
            <Form.Item label={t('SAMPLING_INTERVAL')}>
              <Select
                className={styles.selectBox}
                value={step}
                name="step"
                options={stepOptions}
                onChange={value => {
                  this.formData.step = value
                  this.forceUpdate()
                }}
              />
            </Form.Item>
          )}
          <div
            className={classnames(styles.actions, {
              [styles.bottom10]: !this.props.showStep,
            })}
          >
            <Button onClick={onCancel}>{t('CANCEL')}</Button>
            <Button type="control" onClick={this.handleOk}>
              {t('OK')}
            </Button>
          </div>
        </Form>
      </div>
    )
  }
}
