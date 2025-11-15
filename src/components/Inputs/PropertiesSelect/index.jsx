import { isEmpty, has } from 'lodash'
import React from 'react'
import PropTypes from 'prop-types'
import classnames from 'classnames'
import { Button } from '@kube-design/components'

import Item from './Item'

import * as styles from './index.scss'

export default class PropertiesInput extends React.Component {
  static propTypes = {
    name: PropTypes.string,
    value: PropTypes.object,
    hiddenKeys: PropTypes.arrayOf(PropTypes.string),
    readOnlyKeys: PropTypes.arrayOf(PropTypes.string),
    controlled: PropTypes.bool,
    onChange: PropTypes.func,
    onError: PropTypes.func,
  }

  static defaultProps = {
    name: '',
    value: {},
    hiddenKeys: [],
    readOnlyKeys: [],
    controlled: false,
    onChange() {},
  }

  constructor(props) {
    super(props)

    this.state = {
      existedKey: false,
      propsValue: props.value,
      hiddenValues: [],
      readOnlyValues: [],
      arrayValues: [],
      data: [],
    }
  }

  async componentDidMount() {
    await this.fetchData()
    const data = await request.get(
      // `/kapis/vgpu.kubesphere.io/v1alpha1/configs/vgpu`
      `/kapis/vgpu.kubesphere.io/v1/configs/vgpu`
    )
    const arrayValues = []

    for (const key in data.nodes) {
      if (Object.prototype.hasOwnProperty.call(data.nodes, key)) {
        arrayValues.push({
          key,
          value: data.nodes[key]['GPUPartitionMultiplier'],
        })
      }
    }
    this.triggerChange(arrayValues)
    this.setState({
      ...this.state,
      arrayValues,
    })
  }

  fetchData = async (params = {}) => {
    params.sortBy = 'createTime'
    params.limit = 200
    const data = await request.get(
      `/kapis/resources.kubesphere.io/v1alpha3/nodes`,
      params
    )

    this.setState({
      ...this.state,
      data,
    })
    return data
  }

  handleAdd = () => {
    this.setState(({ arrayValues }) => ({
      arrayValues: [...arrayValues, { key: '' }],
    }))
  }

  triggerChange = arrayValues => {
    const { onChange } = this.props
    const { hiddenValues, readOnlyValues } = this.state
    let existedKey = false
    let emptyKeyValue = false

    this.props.onError()

    const valuePairs = [...hiddenValues, ...readOnlyValues, ...arrayValues]
    const value = valuePairs.reduce((prev, cur) => {
      cur.key = cur.key || ''

      // when add new line, do not change value
      if (isEmpty(cur.key) && isEmpty(cur.value)) {
        emptyKeyValue = true
      }

      // has duplicate keys
      if (has(prev, cur.key)) {
        existedKey = true
        return prev
      }

      return {
        ...prev,
        [cur.key]: cur.value || '',
      }
    }, {})

    this.setState({ arrayValues }, () => {
      if (emptyKeyValue) {
        return
      }

      if (!existedKey) {
        onChange(value)
      }
    })

    // some key is empty, throw error
    const hasEmptyKey = Object.keys(value).some(key => isEmpty(key))

    // has duplicate keys, throw error
    if (hasEmptyKey) {
      this.props.onError({ message: t('EMPTY_KEY') })
    } else if (existedKey) {
      this.props.onError({ message: t('DUPLICATE_KEYS') })
    } else {
      this.props.onError()
    }
  }

  handleItemChange = (index, value) => {
    const { arrayValues } = this.state
    arrayValues[index] = value
    this.triggerChange(arrayValues)
  }

  handleItemDelete = index => {
    const { arrayValues } = this.state
    this.triggerChange(arrayValues.filter((_, _index) => _index !== index))
  }

  isAddEnable() {
    const { arrayValues } = this.state

    return arrayValues.every(
      item => !(isEmpty(item) || (!item.key && !item.value))
    )
  }

  render() {
    const { className, addText, itemProps } = this.props
    const { readOnlyValues, arrayValues, data } = this.state

    return (
      <div className={classnames(styles.wrapper, className)}>
        {readOnlyValues.map(item => (
          <Item
            key={`readonly-${item.key}`}
            value={item}
            readOnly
            {...itemProps}
          />
        ))}
        {arrayValues.map((item, index) => (
          <Item
            key={`array-${index}`}
            index={index}
            value={item || {}}
            fetchData={this.fetchData}
            data={data}
            onChange={this.handleItemChange}
            onDelete={this.handleItemDelete}
            {...itemProps}
          />
        ))}
        <div className="text-right">
          <Button
            className={styles.add}
            onClick={this.handleAdd}
            disabled={!this.isAddEnable()}
          >
            {addText}
          </Button>
        </div>
      </div>
    )
  }
}
