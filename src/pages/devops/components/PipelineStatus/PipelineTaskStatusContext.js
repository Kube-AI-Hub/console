import React from 'react'

const PipelineTaskStatusContext = React.createContext({
  onProceed: () => {},
  onBreak: () => {},
  result: '',
})

export default PipelineTaskStatusContext
