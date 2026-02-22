import React from 'react'

const ContainerFormContext = React.createContext({
  forceUpdate: () => {},
  imageDetail: {},
  setImageDetail: () => {},
})

export default ContainerFormContext
