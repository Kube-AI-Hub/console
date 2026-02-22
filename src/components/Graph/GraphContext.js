import React from 'react'

const GraphContext = React.createContext({
  selectedData: {},
  selectedType: '',
  onSelectApp: () => {},
})

export default GraphContext
