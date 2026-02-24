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
import { omit } from 'lodash'

import { Button, Icon } from '@kube-design/components'

import DefaultRange from './Range/Default'
import CustomRange from './Range/Custom'

import { getLastTimeStr, getTimeLabel, getDateStr, getMinutes } from './utils'
import * as styles from './index.scss'

export default class TimeSelector extends React.PureComponent {
  static propTypes = {
    step: PropTypes.string,
    times: PropTypes.number,
    onChange: PropTypes.func,
    onToggle: PropTypes.func,
  }

  static defaultProps = {
    step: '10m',
    times: 30,
    onChange() {},
    onToggle() {},
  }

  constructor(props) {
    super(props)

    const { step, times } = props

    this.state = {
      visible: false,
      prevPropStep: step,
      step,
      prevPropTimes: times,
      times,
      start: '',
      end: '',
      lastTime: '',
    }
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (
      nextProps.step !== prevState.prevPropStep ||
      nextProps.times !== prevState.prevPropTimes
    ) {
      const { step, times } = nextProps
      return {
        prevPropStep: step,
        step,
        prevPropTimes: times,
        times,
      }
    }
    return null
  }

  handleToggle = () => {
    this.setState({ visible: !this.state.visible }, () => {
      this.props.onToggle(this.state.visible)
    })
  }

  hideSelector = () => {
    this.setState({ visible: false }, () => {
      this.props.onToggle(false)
    })
  }

  handleTimeChange = data => {
    this.setState({ visible: false, ...data }, () => {
      const newData = omit(data, ['lastTime'])

      this.props.onChange(newData)
    })
  }

  renderButtonText() {
    const { step, times, start, end, lastTime } = this.state
    const { showStep = true } = this.props

    if (start && end && !lastTime) {
      const intervalText = `(${t('INTERVAL')} ${getTimeLabel(step)})`
      return `${getDateStr(start)} ~ ${getDateStr(end)} ${
        showStep ? intervalText : ''
      }`
    }

    const lastTimeText = getTimeLabel(lastTime || getLastTimeStr(step, times))
    return t('LAST_TIME', { value: lastTimeText })
  }

  getEffectiveStartEnd() {
    const { step, times, start, end } = this.state
    const nowSec = Math.floor(Date.now() / 1000)
    const effectiveEnd = end ? Number(end) : nowSec
    const effectiveStart = start
      ? Number(start)
      : effectiveEnd -
        Math.round(getMinutes(step || '10m') * 60 * (times || 30))
    return {
      start: new Date(effectiveStart * 1000),
      end: new Date(effectiveEnd * 1000),
    }
  }

  renderContent() {
    const { step, times } = this.state
    const { showStep = true } = this.props
    const {
      start: effectiveStart,
      end: effectiveEnd,
    } = this.getEffectiveStartEnd()
    return (
      <div className={styles.content}>
        <div className={styles.rangePanels}>
          <div className={styles.defaultRangeWrap}>
            <DefaultRange
              step={step}
              times={times}
              onChange={this.handleTimeChange}
            />
            <div className={styles.stepHint}>
              {t('MONITORING_STEP_AUTO_ADAPT_HINT')}
            </div>
          </div>
          <CustomRange
            step={step}
            times={times}
            start={effectiveStart}
            end={effectiveEnd}
            showStep={showStep}
            onSubmit={this.handleTimeChange}
            onCancel={this.hideSelector}
          />
        </div>
      </div>
    )
  }

  render() {
    const { className, dark, arrowIcon } = this.props
    return (
      <div
        className={classnames(styles.selector, className, {
          [styles.active]: this.state.visible,
        })}
      >
        <div
          className={classnames(styles.mask, {
            [styles.active]: this.state.visible,
          })}
          onClick={this.hideSelector}
        />
        <Button className={styles.button} onClick={this.handleToggle}>
          <Icon type={dark ? 'dark' : 'light'} name="timed-task" size={20} />
          <p>{this.renderButtonText()}</p>
          <Icon
            className={styles.arrow}
            type={dark ? 'dark' : 'light'}
            name={arrowIcon || 'caret-down'}
          />
        </Button>
        <div className={styles.dropdown}>{this.renderContent()}</div>
      </div>
    )
  }
}
