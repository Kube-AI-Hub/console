import React from 'react'
import { Button, Input, Select } from '@kube-design/components'

import ObjectInput from '../ObjectInput'
import * as styles from './index.scss'

export default class PropertyItem extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      items: props.data.items,
      pagination: {
        page: 1,
        limit: 5,
        total: props.data.totalItems,
      },
    }
  }

  fetchData = async (params = {}) => {
    const data = await this.props.fetchData(params)
    this.setState({
      ...this.state,
      items: data.items,
    })
    return data.items
  }

  handleChange = value => {
    const { index, onChange } = this.props
    onChange(index, value)
  }

  handleDelete = () => {
    const { index, onDelete } = this.props
    onDelete(index)
  }

  render() {
    const {
      readOnly,
      onDelete,
      onChange,
      keyProps = {},
      valueProps = {},
      ...rest
    } = this.props
    const { pagination } = this.state
    const { component: KeyInput = Select, ...keyInputProps } = keyProps
    const { component: ValueInput = Input, ...valueInputProps } = valueProps

    return (
      <div className={styles.item}>
        <ObjectInput {...rest} onChange={this.handleChange}>
          <KeyInput
            name="key"
            pagination={pagination}
            onFetch={this.fetchData}
            options={this.state.items.map(item => {
              return { label: item.metadata.name, value: item.metadata.name }
            })}
            searchable
            clearable
            placeholder={t('NODE_NAME_PLACEHOLDER')}
            {...keyInputProps}
          />
          <ValueInput
            name="value"
            type="number"
            placeholder={t('VIRTUAL_GPU_MULTIPLE_PLACEHOLDER')}
            readOnly={readOnly}
            {...valueInputProps}
          />
        </ObjectInput>
        {!readOnly && (
          <Button
            type="flat"
            icon="trash"
            className={styles.delete}
            onClick={this.handleDelete}
          />
        )}
      </div>
    )
  }
}
