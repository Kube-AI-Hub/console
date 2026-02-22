import React from 'react'

const FullCreateContext = React.createContext({
  setSteps: () => {},
  setCurrentStep: () => {},
  setFormData: () => {},
})

export default FullCreateContext
