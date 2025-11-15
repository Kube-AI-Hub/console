import React from 'react'
import PropTypes from 'prop-types'
import { trim } from 'lodash'
import { Form, Input, TextArea } from '@kube-design/components'
import { ReactComponent as BackIcon } from 'assets/back.svg'

import * as styles from './index.scss'

export default class DataForm extends React.Component {
  static defaultProps = {
    detail: {},
    selectKey: '',
  }

  static contextTypes = {
    registerSubRoute: PropTypes.func,
    resetSubRoute: PropTypes.func,
  }

  formRef = React.createRef()

  state = {
    formData: this.getFormData(),
  }

  componentDidMount() {
    this.registerForm()
  }

  registerForm = () => {
    const { registerSubRoute } = this.context
    const { onCancel } = this.props

    registerSubRoute && registerSubRoute(this.handleSubmit, onCancel)
  }

  handleGoBack = () => {
    const { resetSubRoute } = this.context

    resetSubRoute && resetSubRoute()

    this.props.onCancel()
  }

  getFormData() {
    const { detail, selectKey } = this.props

    return {
      key: selectKey || '',
      value: detail[selectKey] || '',
    }
  }

  handleSubmit = callback => {
    const { onOk } = this.props
    const form = this.formRef && this.formRef.current

    form &&
      form.validate(() => {
        const { key, value } = form.getData()
        onOk({ [trim(key)]: value })
        callback && callback()
      })
  }

  render() {
    const { detail, selectKey } = this.props

    return (
      <div className={styles.wrapper}>
        <div className="h6">
          <a className="custom-icon" onClick={this.handleGoBack}>
            <BackIcon />
          </a>
          {!detail[selectKey] ? t('ADD_DATA_TCAP') : t('EDIT_DATA_TCAP')}
        </div>
        <div className={styles.formWrapper}>
          <Form data={this.state.formData} ref={this.formRef}>
            <Form.Item
              label={t('DATA_KEY')}
              description={t('CONFIG_FIELD_DESC')}
            >
              <Input name="key" />
            </Form.Item>
            <Form.Item
              label={t('DATA_VALUE')}
              description={t('ENTER_CONFIG_VALUE_DESC')}
            >
              <TextArea maxHeight={430} name="value" rows={4} autoResize />
            </Form.Item>
          </Form>
        </div>
      </div>
    )
  }
}
