import React from "react";
import PropTypes from "prop-types";
import classnames from "classnames";
import Schema from "async-validator";
import { debounce, set, get, isFunction } from "lodash";
import FormContext from "./FormContext";

export default class Form extends React.Component {
  static propTypes = {
    className: PropTypes.string,
    onChange: PropTypes.func,
    onSubmit: PropTypes.func,
    defaultData: PropTypes.object,
    data: PropTypes.object,
    type: PropTypes.string,
  };

  static defaultProps = {
    defaultData: {},
    className: "",
    type: "",
  };

  constructor(props) {
    super(props);
    this.descriptor = {};

    this.state = { errors: [], formData: props.data || {} };

    this.triggerFormChange = props.onChange
      ? debounce(props.onChange, 500)
      : null;

    this.customValidator = null;
  }

  static getDerivedStateFromProps(props, state) {
    if (props.data !== state.formData) {
      return { formData: props.data || {} };
    }
    return null;
  }

  handleSubmit = (e) => {
    const { onSubmit } = this.props;

    e.preventDefault();

    this.validate(() => {
      onSubmit && onSubmit(this.state.formData);
    });
  };

  validate = (callback) => {
    if (isFunction(this.customValidator)) {
      this.customValidator(() => {
        this.validator(callback);
      });
    } else {
      this.validator(callback);
    }
  };

  validator = (callback) => {
    const schema = new Schema(this.descriptor);
    const data = Object.keys(this.descriptor).reduce(
      (prev, cur) => ({
        ...prev,
        [cur]: get(this.state.formData, cur),
      }),
      {}
    );

    schema.validate(data, { firstFields: true }, (errors) => {
      if (errors) {
        return this.setState({ errors });
      }
      callback && callback();
    });
  };

  registerValidate = (name, rules) => {
    this.descriptor[name] = rules;
  };

  resetValidate = (name) => {
    delete this.descriptor[name];
  };

  resetValidateResults = (name) => {
    this.setState(({ errors }) => ({
      errors: errors.filter((error) => error.field !== name),
    }));
  };

  getData() {
    return this.state.formData;
  }

  setData(name, value) {
    set(this.state.formData, name, value);
  }

  resetData() {
    this.setState({ formData: this.props.defaultData });
  }

  setCustomValidator(validator) {
    this.customValidator = validator;
  }

  getFormContextValue() {
    return {
      formData: this.state.formData,
      onFormChange: this.triggerFormChange,
      registerValidate: this.registerValidate,
      resetValidate: this.resetValidate,
      validateResults: this.state.errors,
      resetValidateResults: this.resetValidateResults,
      registerGroup: undefined,
      unRegisterGroup: undefined,
    };
  }

  render() {
    const { className, children, type } = this.props;
    const classNames = classnames("form", className);
    const contextValue = this.getFormContextValue();

    if (type === "inner") {
      return (
        <FormContext.Provider value={contextValue}>
          <div className={classNames}>{children}</div>
        </FormContext.Provider>
      );
    }

    return (
      <FormContext.Provider value={contextValue}>
        <form
          className={classNames}
          onSubmit={this.handleSubmit}
          autoComplete="off"
        >
          {children}
        </form>
      </FormContext.Provider>
    );
  }
}
