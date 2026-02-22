import React from 'react'

const PipelineStepsContext = React.createContext({
  toggleAddStep: () => () => {},
  handleEdit: () => () => {},
  handleDeleteStep: () => () => {},
})

export default PipelineStepsContext
