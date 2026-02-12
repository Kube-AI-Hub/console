import { getIndexRoute } from 'utils/router.config'

import RunningStatus from './tabs/RunningStatus'
import Pods from './tabs/Pods'
import Monitoring from './tabs/Monitoring'
import Events from './tabs/Events'

const PATH = '/clusters/:cluster/nodes/:node/gpus/:gpuUuid'

export default [
  {
    path: `${PATH}/status`,
    title: 'RUNNING_STATUS',
    component: RunningStatus,
    exact: true,
  },
  {
    path: `${PATH}/pods`,
    title: 'PODS',
    component: Pods,
    exact: true,
  },
  {
    path: `${PATH}/monitors`,
    title: 'MONITORING',
    component: Monitoring,
    exact: true,
  },
  {
    path: `${PATH}/events`,
    title: 'EVENT_PL',
    component: Events,
    exact: true,
  },
  getIndexRoute({ path: PATH, to: `${PATH}/status`, exact: true }),
]
