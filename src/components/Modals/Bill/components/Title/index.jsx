import React from 'react'
import { Select, Icon } from '@kube-design/components'
import * as styles from './index.scss'

import variables from '~scss/variables.module.scss'

const Title = ({ type, cluster, clusters, setCluster }) => {
  const handleChangeCluster = value => {
    setCluster(value)
  }

  const renderDisabledTip = () => {
    return (
      <Icon
        name="update"
        color={{
          primary: variables.yellowColor02,
          secondary: variables.yellowColor03,
        }}
      />
    )
  }

  const optionRender = ({ label, disabled }) => {
    return (
      <span style={{ display: 'flex', alignItem: 'center' }}>
        {label}
        <span style={{ marginLeft: '10px' }}>
          {disabled ? renderDisabledTip() : null}
        </span>
      </span>
    )
  }

  return (
    <div className={styles.title}>
      <h2>{t('RESOURCE_CONSUMPTION_STATISTICS')}</h2>
      {type === 'workspaces' &&
      globals.app.isMultiCluster &&
      clusters.length > 0 ? (
        <Select
          className={styles.clusterSelect}
          options={clusters}
          optionRenderer={optionRender}
          value={cluster}
          onChange={handleChangeCluster}
        />
      ) : null}
    </div>
  )
}

export default Title
