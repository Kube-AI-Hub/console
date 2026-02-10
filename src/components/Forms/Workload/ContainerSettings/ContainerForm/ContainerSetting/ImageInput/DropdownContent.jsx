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

import { get, set, isEmpty } from 'lodash'
import classnames from 'classnames'
import { Icon, InputSearch, Loading } from '@kube-design/components'
import Select from './Select'
import Input from './Input'

import * as styles from './index.scss'

export default class DropdownContent extends React.Component {
  static contextTypes = {
    setImageDetail: PropTypes.func,
  }

  constructor(props) {
    super(props)
    const { imageRegistries } = this.props
    const harborData =
      this.hubType === 'harbor'
        ? imageRegistries.find(item => item.value === this.secretValue)
        : {}

    this.state = {
      dockerList: [],
      harborList: [],
      harborData,
      visible: false,
      isLoading: false,
    }

    this.store = props.store
    this.dropContentRef = React.createRef()
    this.dropdownWrapperRef = React.createRef()
    this.isUnMounted = false
  }

  debugLog = (message, payload = {}) => {
    if (process.env.NODE_ENV === 'production') {
      return
    }
    // eslint-disable-next-line no-console
    console.log(`[ImageInput][DropdownContent] ${message}`, payload)
  }

  static defaultProps = {
    imageRegistries: [],
    className: '',
    value: '',
    onChange: () => {},
  }

  get defaultImage() {
    const { imageRegistries } = this.props
    return imageRegistries.find(item => item.isDefault)
  }

  get secretValue() {
    const { formTemplate, type } = this.props
    if (type === 'Edit') {
      return get(formTemplate, 'pullSecret', '')
    }
    return get(formTemplate, 'pullSecret', this.defaultImage?.value || '')
  }

  get hubType() {
    if (this.registryUrl.indexOf('docker.io') >= 0 || this.secretValue === '') {
      return 'dockerHub'
    }

    if (
      this.secretValue &&
      this.registryUrl.indexOf('docker.io') < 0 &&
      this.registryUrl.toLowerCase().includes('harbor')
    ) {
      return 'harbor'
    }

    return 'others'
  }

  get registryUrl() {
    const { imageRegistries } = this.props
    if (!isEmpty(imageRegistries) && this.secretValue) {
      const selectedSecret = imageRegistries.find(
        item => item.value === this.secretValue
      )

      let url = get(selectedSecret, 'url', '')
      if (url) {
        // remove url scheme
        url = url.replace(/^(http(s)?:\/\/)?(.*)$/, '$3')
        return url
      }
    }

    return ''
  }

  get imageName() {
    const { value } = this.props

    if (value.startsWith(this.registryUrl)) {
      const reg = new RegExp(`${this.registryUrl}(/)?`)
      return value.replace(reg, '')
    }
    return value
  }

  get secretsOptions() {
    const { imageRegistries } = this.props
    const options = imageRegistries.map(item => {
      const name = item.aliasName || item.value
      const url = (item.url || '').replace(/^(https?:\/\/)?/, '')
      return {
        label: name,
        selectedLabel: `${name} (${url})`,
        value: item.value,
        url: item.url,
        isDefault: item.isDefault,
      }
    })

    const defaultOptions = options.filter(item => item.isDefault)
    const nonDefaultOptions = options.filter(item => !item.isDefault)

    return [
      ...defaultOptions,
      { label: `Docker Hub`, value: '', url: '' },
      ...nonDefaultOptions,
    ]
  }

  componentDidMount() {
    this.debugLog('mounted', {
      imageRegistriesCount: this.props.imageRegistries.length,
      secretValue: this.secretValue,
      hubType: this.hubType,
      registryUrl: this.registryUrl,
      options: this.secretsOptions.map(item => item.value),
    })

    if (this.props.type !== 'Edit' && this.secretValue !== '') {
      this.handleSecretChange(this.secretValue)
    }

    if (this.hubType === 'dockerHub') {
      this.fetchDockerList()
    }

    if (this.hubType === 'harbor') {
      this.fetchHarborList('', this.state.harborData)
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      prevProps.imageRegistries !== this.props.imageRegistries ||
      prevState.visible !== this.state.visible ||
      prevProps.value !== this.props.value
    ) {
      this.debugLog('updated', {
        imageRegistriesCount: this.props.imageRegistries.length,
        secretValue: this.secretValue,
        hubType: this.hubType,
        registryUrl: this.registryUrl,
        visible: this.state.visible,
        imageValue: this.props.value,
        options: this.secretsOptions.map(item => item.value),
      })
    }
  }

  componentWillUnmount() {
    this.isUnMounted = true
    document.removeEventListener('click', this.handleDOMClick)
  }

  handleDOMClick = e => {
    if (
      this.dropdownWrapperRef &&
      this.dropdownWrapperRef.current &&
      !this.dropdownWrapperRef.current.contains(e.target)
    ) {
      this.hideContent()
    }
  }

  showContent = () => {
    this.debugLog('showContent', {
      hubType: this.hubType,
      secretValue: this.secretValue,
      registryUrl: this.registryUrl,
      harborData: this.state.harborData,
    })

    this.setState({ visible: true }, () => {
      document.addEventListener('click', this.handleDOMClick)
      if (this.hubType === 'harbor') {
        this.fetchHarborList('', this.state.harborData)
      }
    })
  }

  hideContent = () => {
    this.debugLog('hideContent', {
      hubType: this.hubType,
      secretValue: this.secretValue,
    })

    if (this.hubType === 'harbor') {
      this.setState({ harborList: [] })
    }

    this.setState({ visible: false }, () => {
      document.removeEventListener('click', this.handleDOMClick)
    })
  }

  handleDropdownIconClick = e => {
    e.stopPropagation()
    this.debugLog('iconClick', {
      visible: this.state.visible,
      hubType: this.hubType,
      secretValue: this.secretValue,
    })
    if (this.state.visible) {
      this.hideContent()
      return
    }
    this.showContent()
  }

  handleDetailRedirect = e => {
    const { image } = e.currentTarget.dataset

    window.open(`https://hub.docker.com/_/${image}`)
  }

  handleSecretChange = value => {
    if (value) {
      const harborData = this.props.imageRegistries.filter(
        hub => hub.value === value
      )[0]

      this.setState({ harborData })
    }

    const { formTemplate } = this.props

    set(formTemplate, 'pullSecret', value)
    this.debugLog('secretChanged', {
      nextSecretValue: value,
      nextRegistryUrl: this.registryUrl,
      options: this.secretsOptions.map(item => item.value),
    })
    this.props.onChange(this.registryUrl)
  }

  handleInputChange = (e, value) => {
    let image = value
    if (this.registryUrl) {
      image = `${this.registryUrl}/${value}`.replace(/\/+/g, '/')
    }
    image = image.replace(/\s+/g, '')
    this.props.onChange(image)
    this.context.setImageDetail && this.context.setImageDetail({ image })
  }

  handleKeyUp = e => {
    if (e.keyCode === 13) {
      this.handleConfirm()
    }
  }

  handleConfirm = () => {
    if (this.imageName) {
      this.props.onEnter()
    }
  }

  handleDockerImageSelected = async e => {
    const { image, logo, short_description } = e.currentTarget.dataset
    this.props.onChange(image)
    this.hideContent()
    this.props.onEnter({ logo, short_description })
  }

  handleHarborImageSelected = async imageDetail => {
    const image = `${imageDetail.repository_name}`
    const logo = ''
    const short_description = ''

    this.props.onChange(`${this.registryUrl}/${image}`)
    this.hideContent()
    this.props.onEnter({ logo, short_description })
  }

  handleSearchDockerHub = keyword => {
    this.fetchDockerList(keyword)
  }

  handleSearchHarbor = keyword => {
    this.fetchHarborList(keyword, this.state.harborData)
  }

  fetchDockerList = async keyword => {
    this.setState({ isLoading: true })

    const result = await this.store
      .getDockerImagesLists({
        q: keyword || '',
        image_filter: keyword ? undefined : 'official',
        page_size: 50,
        type: 'image',
      })
      .finally(() => {
        !this.isUnMounted && this.setState({ isLoading: false })
      })

    !this.isUnMounted &&
      this.setState({ dockerList: get(result, 'summaries', []) })
  }

  fetchHarborList = async (keyword, harborData) => {
    const url = get(harborData, 'url')

    if (!url || isEmpty(harborData)) return

    this.setState({ isLoading: true })

    const result = await this.store
      .getHarborImagesLists({
        harborData,
        params: {
          q: keyword || '',
        },
      })
      .finally(() => {
        !this.isUnMounted && this.setState({ isLoading: false })
      })

    !this.isUnMounted &&
      this.setState({ harborList: get(result, 'repository', []) })
  }

  renderContent = () => {
    if (this.state.visible) {
      return (
        <div
          className={classnames(styles.dropContent, {
            [styles.dropContent_hide]: !this.state.visible,
          })}
          ref={this.dropContentRef}
        >
          <div className={styles.header}>
            <InputSearch
              className={styles.search}
              onSearch={
                this.hubType === 'dockerHub'
                  ? this.handleSearchDockerHub
                  : this.handleSearchHarbor
              }
              placeholder={t('SEARCH')}
            />
            {this.state.isLoading && (
              <Loading className="float-left" size={28} />
            )}
          </div>
          {this.hubType === 'dockerHub'
            ? this.renderDockerList()
            : this.renderHarborList()}
        </div>
      )
    }
    return null
  }

  renderDockerList() {
    if (isEmpty(this.state.dockerList)) {
      return (
        <ul className={styles.listContent}>
          <div
            className={classnames(styles.selectedContent, styles.emptyContent)}
          >
            <div>
              <Icon name="docker" className={styles.icon} />
              <p className={styles.desc}>{t('NO_IMAGE_FOUND')}</p>
            </div>
          </div>
        </ul>
      )
    }

    return (
      <ul className={styles.listContent}>
        {this.state.dockerList.map(image => (
          <li className={styles.ImageItem} key={image.name}>
            <img
              src={get(image, 'logo_url.large') || '/assets/no_img.svg'}
              alt={image.name}
            />
            <div className={styles.info}>
              <p
                onClick={this.handleDockerImageSelected}
                className={styles.clickable}
                data-image={image.slug}
                data-logo={get(image, 'logo_url.large', '')}
                data-short_description={image.short_description}
              >
                {image.name}
              </p>
              <p>{image.short_description}</p>
            </div>
            <div className={styles.starContainer}>
              <Icon className={styles.star} name="star" />
              {image.star_count}
            </div>
            <div className={styles.actions}>
              <span
                className={styles.clickable}
                onClick={this.handleDetailRedirect}
                data-image={image.slug}
              >
                <Icon name="paper" size={16} changeable />
              </span>
              <span
                className={styles.clickable}
                onClick={this.handleDockerImageSelected}
                data-image={image.slug}
                data-logo={get(image, 'logo_url.large', '')}
                data-short_description={image.short_description}
              >
                <Icon name="check" size={16} changeable />
              </span>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  renderHarborList() {
    if (isEmpty(this.state.harborList)) {
      return (
        <ul className={styles.listContent}>
          <div
            className={classnames(styles.selectedContent, styles.emptyContent)}
          >
            <div>
              <Icon name="docker" className={styles.icon} />
              <p className={styles.desc}>{t('NO_IMAGE_FOUND')}</p>
            </div>
          </div>
        </ul>
      )
    }
    return (
      <ul className={styles.listContent}>
        {this.state.harborList.map(image => (
          <li className={styles.ImageItem} key={image.repository_name}>
            <img src={'/assets/no_img.svg'} alt={image.repository_name} />
            <div className={styles.info}>
              <p
                onClick={e => this.handleHarborImageSelected(image, e)}
                className={styles.clickable}
              >
                {image.repository_name}
              </p>
            </div>
            <div className={styles.actions}>
              <span
                className={styles.clickable}
                onClick={e => this.handleHarborImageSelected(image, e)}
              >
                <Icon name="check" size={16} changeable />
              </span>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  render() {
    return (
      <div className={styles.dropdownWrapper} ref={this.dropdownWrapperRef}>
        <Input
          className={styles.imageInput}
          onChange={this.handleInputChange}
          value={this.imageName}
          autoComplete="off"
          placeholder={
            this.secretValue ? 'nginx:latest' : t('IMAGE_PLACEHOLDER')
          }
          onBlur={this.handleConfirm}
          onKeyUp={this.handleKeyUp}
        >
          <Select
            value={this.secretValue}
            className={styles.secretSelect}
            options={this.secretsOptions}
            onChange={this.handleSecretChange}
            disabled={this.secretsOptions.length <= 1}
            containerType={this.props.containerType || 'worker'}
          />
        </Input>
        {this.hubType !== 'others' &&
        !globals.config.enableImageSearch ? null : (
          <Icon
            name="templet"
            changeable
            className={styles.dropDownIcon}
            onClick={this.handleDropdownIconClick}
          />
        )}
        {this.renderContent()}
      </div>
    )
  }
}
