import React from 'react'

const GatewayContext = React.createContext({
  gatewayName: '',
  gatewayNs: '',
  cluster: '',
})

export default GatewayContext
