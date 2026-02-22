import React from 'react'

const SubRouteContext = React.createContext({
  registerSubRoute: () => {},
  resetSubRoute: () => {},
  setSteps: () => {},
  setCurrentStep: () => {},
})

export default SubRouteContext
