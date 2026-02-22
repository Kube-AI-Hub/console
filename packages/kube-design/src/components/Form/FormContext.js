import React from "react";

const FormContext = React.createContext({
  formData: {},
  onFormChange: null,
  registerValidate: () => {},
  resetValidate: () => {},
  validateResults: [],
  resetValidateResults: () => {},
  registerGroup: undefined,
  unRegisterGroup: undefined,
});

export default FormContext;
