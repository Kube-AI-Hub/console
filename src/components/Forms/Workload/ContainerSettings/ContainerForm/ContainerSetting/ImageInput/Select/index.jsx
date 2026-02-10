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
import { debounce, isEmpty, isUndefined } from 'lodash'
import isEqual from 'react-fast-compare'
import classNames from 'classnames'
import { Icon } from '@kube-design/components'

import * as styles from './index.scss'

export default class Select extends React.Component {
  static propTypes = {
    className: PropTypes.string,
    value: PropTypes.any,
    defaultValue: PropTypes.any,
    options: PropTypes.array.isRequired,
    onChange: PropTypes.func,
    containerType: PropTypes.oneOf(['worker', 'init']),
  }

  static defaultProps = {
    className: '',
    defaultValue: '',
    options: [],
    onChange() {},
    containerType: 'worker',
  }

  constructor(props) {
    super(props)

    this.state = {
      value: isUndefined(props.value) ? props.defaultValue : props.value,
      showOptions: false,
    }

    this.optionsRef = React.createRef()
    this.wrapperRef = React.createRef()
  }

  debugLog = (message, payload = {}) => {
    if (process.env.NODE_ENV === 'production') {
      return
    }
    // eslint-disable-next-line no-console
    console.log(`[ImageInput][Select] ${message}`, payload)
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (
      !isUndefined(nextProps.value) &&
      !isEqual(nextProps.value, prevState.value)
    ) {
      return {
        value: nextProps.value,
      }
    }

    return null
  }

  triggerChange = debounce(() => {
    const { onChange } = this.props

    onChange(this.state.value)
  })

  handleClick = (e, value) => {
    e.stopPropagation()
    this.debugLog('optionClick', {
      value,
      options: this.props.options.map(item => item.value),
    })
    document.removeEventListener('click', this.handleDOMClick)
    this.setState({ value, showOptions: false }, () => {
      const { onChange } = this.props
      onChange(value)
    })
  }

  handleShowOptions = () => {
    this.debugLog('dropdownOpen', {
      selected: this.state.value,
      optionsCount: this.props.options.length,
    })
    this.setState({ showOptions: true })
  }

  handleHideOptions = () => {
    this.debugLog('dropdownClose', {
      selected: this.state.value,
    })
    this.setState({ showOptions: false })
  }

  handleDOMClick = e => {
    if (
      this.wrapperRef &&
      this.wrapperRef.current &&
      !this.wrapperRef.current.contains(e.target)
    ) {
      this.handleHideOptions()
    }
  }

  toggleShowOptions = e => {
    e.stopPropagation()
    const { disabled, options } = this.props
    if (disabled || isEmpty(options)) {
      this.debugLog('toggleBlocked', {
        disabled,
        optionsCount: options.length,
      })
      return
    }

    const nextShowOptions = !this.state.showOptions
    this.debugLog('toggleShowOptions', {
      currentVisible: this.state.showOptions,
      nextVisible: nextShowOptions,
      options: options.map(item => item.value),
      selected: this.state.value,
    })

    if (nextShowOptions) {
      document.addEventListener('click', this.handleDOMClick)
      this.handleShowOptions()
    } else {
      document.removeEventListener('click', this.handleDOMClick)
      this.handleHideOptions()
    }
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.handleDOMClick)
  }

  renderOption(option, selected) {
    const { containerType = 'worker' } = this.props
    const onClick = e => this.handleClick(e, option.value)
    return (
      <div
        key={option.uid || option.value}
        onClick={onClick}
        className={classNames(styles.option, { [styles.selected]: selected })}
      >
        <div className={styles.optionCol}>
          <span className={styles.optionLabel}>
            {option.selectedLabel || option.label}
          </span>
          {option.isDefault && (
            <span
              className={classNames(styles.defaultTag, {
                [styles.defaultTag_warning]: containerType === 'init',
              })}
            >
              {t('DEFAULT')}
            </span>
          )}
        </div>
      </div>
    )
  }

  renderOptions() {
    const { options, disabled } = this.props
    const { value } = this.state

    if (disabled || isEmpty(options)) {
      return null
    }

    return (
      <div className={styles.options}>
        {options.map(option =>
          this.renderOption(option, isEqual(option.value, value))
        )}
      </div>
    )
  }

  renderControl() {
    const { placeholder, options, disabled } = this.props
    const { value } = this.state

    const option =
      options.find(item => isEqual(item.value, value)) || placeholder || {}

    const displayLabel = option.selectedLabel || option.label

    return (
      <div className={styles.control}>
        <span className={styles.label}>{displayLabel}</span>
        {!disabled && (
          <Icon
            className={classNames(styles.rightIcon, {
              [styles.rightIcon_toggle]: this.state.showOptions,
            })}
            name="chevron-down"
            size={20}
          />
        )}
      </div>
    )
  }

  render() {
    const { className, disabled } = this.props
    return (
      <div
        className={classNames(
          styles.wrapper,
          { [styles.disabled]: disabled },
          className
        )}
        ref={this.wrapperRef}
        onClick={this.toggleShowOptions}
      >
        {this.renderControl()}
        {this.state.showOptions ? this.renderOptions() : null}
      </div>
    )
  }
}
