/*
 * This file is part of KubeSphere Console.
 * Copyright (C) 2019 The KubeSphere Console Authors.
 *
 * KubeSphere Console is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * KubeSphere Console is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with KubeSphere Console.  If not, see <https://www.gnu.org/licenses/>.
 */

import React from 'react'
import { toJS, computed } from 'mobx'
import { observer, inject } from 'mobx-react'
import classnames from 'classnames'
import { get } from 'lodash'

import ComponentMonitoringStore from 'stores/monitoring/component'
import request from 'utils/request'
import { getVendorDisplayName } from 'utils'
import { renderGpuVendorIcon } from 'utils/gpuVendors'
import variables from '~scss/variables.module.scss'
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Sector,
  ResponsiveContainer,
} from 'recharts'

import { Columns, Column, Loading, Icon } from '@kube-design/components'
import { Card } from 'components/Base'
import { StatusCircle } from 'components/Cards/Monitoring'
import {
  ClusterResourceStatus,
  ETCDStatusTab,
  ServiceComponentStatus,
} from 'clusters/components/Cards/Monitoring'

import * as styles from './index.scss'

const PIE_COLORS = [
  variables.greenColor01,
  variables.greenColor02,
  variables.greenColor03,
  variables.greenColor04,
  variables.blueColor01,
  variables.blueColor02,
  variables.blueColor03,
  variables.blueColor04,
  variables.blueColor05,
]

const renderNodePieActiveShape = props => {
  const RADIAN = Math.PI / 180
  const {
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    percent,
    value,
  } = props
  const sin = Math.sin(-RADIAN * midAngle)
  const cos = Math.cos(-RADIAN * midAngle)
  const sx = cx + (outerRadius + 10) * cos
  const sy = cy + (outerRadius + 10) * sin
  const mx = cx + (outerRadius + 30) * cos
  const my = cy + (outerRadius + 30) * sin
  const ex = mx + (cos >= 0 ? 1 : -1) * 22
  const ey = my
  const textAnchor = cos >= 0 ? 'start' : 'end'

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill}>
        {payload.displayName}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 6}
        outerRadius={outerRadius + 10}
        fill={fill}
      />
      <path
        d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
        stroke={fill}
        fill="none"
      />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 12}
        y={ey}
        textAnchor={textAnchor}
        fill={variables.darkColor06}
      >
        {`${value} ${t('NODE_PL')}`}
      </text>
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 12}
        y={ey}
        dy={18}
        textAnchor={textAnchor}
        fill={variables.darkColor01}
      >
        {`(${(percent * 100).toFixed(1)}%)`}
      </text>
    </g>
  )
}

@inject('rootStore')
@observer
class Overview extends React.Component {
  constructor(props) {
    super(props)

    this.componentMonitoringStore = new ComponentMonitoringStore({
      cluster: this.cluster,
    })
    this.state = {
      nodeStats: {},
      nodeStatsLoading: true,
      activePieIndex: 0,
    }
    this.fetchData()
  }

  get routing() {
    return this.props.rootStore.routing
  }

  get cluster() {
    return this.props.match.params.cluster
  }

  @computed
  get componentHealth() {
    return toJS(this.componentMonitoringStore.health)
  }

  @computed
  get supportETCD() {
    return this.props.rootStore.monitoring.supportETCD
  }

  componentDidMount() {
    this.updateData()
    this.fetchNodeStats()
  }

  getNodeStatsApiPath = () =>
    globals.app.isMultiCluster
      ? `/kapis/clusters/${this.cluster}/resources.kubesphere.io/v1alpha3`
      : '/kapis/resources.kubesphere.io/v1alpha3'

  fetchNodeStats = async () => {
    this.setState({ nodeStatsLoading: true })
    try {
      const result = await request.get(
        `${this.getNodeStatsApiPath()}/nodes/stats`
      )
      this.setState({
        nodeStats: typeof result === 'object' && result !== null ? result : {},
        nodeStatsLoading: false,
      })
    } catch {
      this.setState({ nodeStats: {}, nodeStatsLoading: false })
    }
  }

  onNodePieEnter = (_, index) => {
    this.setState({ activePieIndex: index })
  }

  renderNodeVendorPie() {
    const { nodeStats, nodeStatsLoading, activePieIndex } = this.state
    const vendorCounts = {}
    Object.keys(nodeStats || {}).forEach(key => {
      if (key === 'total' || key === 'healthy') return
      const vendor = key
      vendorCounts[vendor] =
        (vendorCounts[vendor] || 0) + Number(nodeStats[key] || 0)
    })
    const total = Object.values(vendorCounts).reduce((a, b) => a + b, 0)
    const data = Object.entries(vendorCounts).map(([vendor, count], i) => ({
      name: vendor,
      displayName:
        vendor === 'CPU'
          ? t('NO_XPU_NODES')
          : getVendorDisplayName(vendor) || vendor,
      value: count,
      percent: total > 0 ? (count / total).toFixed(2) : '0',
      color: PIE_COLORS[i % PIE_COLORS.length],
    }))
    return (
      <Card className={styles.pie} title={t('NODE_VENDOR_DISTRIBUTION')}>
        <Loading spinning={nodeStatsLoading}>
          {total === 0 ? (
            <div className={styles.piePlaceholder}>{t('NO_DATA')}</div>
          ) : (
            <div className={styles.pieWrapper}>
              <div className={styles.vendorList}>
                {data.map(item => (
                  <div key={item.name} className={styles.vendorItem}>
                    <i
                      className={styles.vendorDot}
                      style={{ backgroundColor: item.color }}
                    />
                    {renderGpuVendorIcon(item.name, 24)}
                    <span className={styles.vendorName}>
                      {item.displayName}
                    </span>
                    <span className={styles.vendorCount}>
                      {item.value} {t('NODE_PL')} ({item.percent}%)
                    </span>
                  </div>
                ))}
              </div>
              <div className={styles.pieChart}>
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      cx="50%"
                      data={data}
                      dataKey="value"
                      innerRadius="60%"
                      outerRadius="75%"
                      activeIndex={activePieIndex}
                      activeShape={renderNodePieActiveShape}
                      onMouseEnter={this.onNodePieEnter}
                    >
                      {data.map(entry => (
                        <Cell
                          key={`cell-${entry.name}`}
                          fill={entry.color}
                          strokeWidth={1}
                        />
                      ))}
                    </Pie>
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </Loading>
      </Card>
    )
  }

  componentWillUnmount() {
    clearTimeout(this.timer)
  }

  updateData = () => {
    this.timer = setTimeout(async () => {
      await this.componentMonitoringStore.requestHealthMetrics()
      this.updateData()
    }, 2000)
  }

  getComponentStatus = component => {
    const conditions = component.conditions || []

    return conditions.some(
      item => item.status !== 'Ture' && item.type !== 'Healthy'
    )
      ? 'unhealthy'
      : 'healthy'
  }

  getCoreComponentStatus = () => {
    const { data = {} } = this.componentHealth
    const { kubernetes = [], node = {} } = data
    const status = {}

    kubernetes.forEach(item => {
      status[get(item, 'metadata.name')] = this.getComponentStatus(item)
    })

    status['node'] =
      node.healthyNodes === node.totalNodes ? 'healthy' : 'unhealthy'

    status['controller-manager'] = this.componentHealth.supportControllerManager
      ? 'healthy'
      : 'unhealthy'
    status['scheduler'] = this.componentHealth.supportKsScheduler
      ? 'healthy'
      : 'unhealthy'
    status['etcd-0'] = this.supportETCD ? 'healthy' : 'unhealthy'

    return status
  }

  fetchData = () => {
    this.componentMonitoringStore.fetchHealthMetrics()
  }

  handleNodeClick = () => {
    globals.app.hasPermission({
      module: 'nodes',
      action: 'view',
      cluster: this.cluster,
    }) && this.routing.push(`/clusters/${this.cluster}/nodes`)
  }

  handleComponentsClick = (disabled, type) => {
    if (type === 'kubeSystem') {
      type = 'kubernetes'
    }
    globals.app.hasPermission({
      module: 'monitoring',
      action: 'view',
      cluster: this.cluster,
    }) &&
      !disabled &&
      this.routing.push(`/clusters/${this.cluster}/components?type=${type}`)
  }

  renderNodeStatus() {
    const { counts, isLoading = false } = this.componentHealth
    const { health = 0, total = 0 } = counts.node || {}

    return (
      <Card className={styles.node} title={t('CLUSTER_NODE_STATUS')}>
        <Loading spinning={isLoading}>
          <StatusCircle
            theme="light"
            className={styles.nodeStatus}
            name={t('NODE_ONLINE_STATUS')}
            legend={['ONLINE_NODES', 'ALL_NODES']}
            used={health}
            total={total}
            onClick={this.handleNodeClick}
          />
        </Loading>
      </Card>
    )
  }

  renderServiceComponents() {
    const { componentCounts: counts } = this.componentHealth
    const components = [
      {
        type: 'kubeaihub',
        icon: '/assets/logo.svg',
        width: 100,
        height: 20,
      },
      {
        type: 'kubeSystem',
        icon: '/assets/kubernetes.svg',
        width: 94,
        height: 20,
      },
      {
        type: 'istio',
        icon: '/assets/istio.svg',
        width: 56,
        height: 16,
        disabled: !globals.app.hasClusterModule(this.cluster, 'servicemesh'),
      },
      {
        type: 'monitoring',
        icon: '/assets/monitoring.svg',
        width: 103,
        height: 20,
        disabled: !globals.app.hasClusterModule(this.cluster, 'monitoring'),
      },
      {
        type: 'logging',
        icon: '/assets/logging.svg',
        width: 82,
        height: 20,
        disabled: !globals.app.hasClusterModule(this.cluster, 'logging'),
      },
      {
        type: 'devops',
        icon: '/assets/dev-ops.svg',
        width: 68,
        height: 17,
        disabled: !globals.app.hasClusterModule(this.cluster, 'devops'),
      },
    ]

    return (
      <div className={classnames(styles.list, styles.service)}>
        {components.map(item => (
          <div
            key={item.type}
            className={classnames(styles.item, {
              [styles.disabled]: item.disabled,
            })}
            onClick={() => this.handleComponentsClick(item.disabled, item.type)}
          >
            <svg
              className="kubed-icon-dark"
              viewBox={`0 0 ${item.width} ${item.height}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <use href={item.icon} />
            </svg>

            {!item.disabled ? (
              <p>
                {get(counts, `[${item.type}].health`, 0)}
                <span>/{get(counts, `[${item.type}].total`, 0)}</span>
              </p>
            ) : (
              <span>{t('DISABLED')}</span>
            )}
          </div>
        ))}
      </div>
    )
  }

  renderCoreComponents() {
    const statuses = this.getCoreComponentStatus()
    const components = [
      {
        type: 'etcd-0',
        name: 'etcd',
      },
      {
        type: 'controller-manager',
        name: t('CONTROLLER_MANAGER'),
      },
      {
        type: 'scheduler',
        name: t('KUBERNETES_SCHEDULER'),
      },
    ]

    return (
      <div className={classnames(styles.list, styles.core)}>
        {components.map(item => {
          const status = statuses[item.type]

          return (
            <div key={item.type} className={styles.item}>
              <div className={classnames(styles.itemIcon, styles[status])}>
                <Icon
                  name={
                    status === 'healthy' || status === 'ready'
                      ? 'check'
                      : 'substract'
                  }
                  type="light"
                  size={16}
                />
              </div>
              <p title={item.name}>{item.name}</p>
            </div>
          )
        })}
      </div>
    )
  }

  renderComponentStatus() {
    const { isLoading = false } = this.componentMonitoringStore.health

    return (
      <Card className={styles.components} title={t('COMPONENT_STATUS')}>
        <Loading spinning={isLoading}>
          <div className={styles.wrapper}>
            {this.renderServiceComponents()}
            {this.renderCoreComponents()}
          </div>
        </Loading>
      </Card>
    )
  }

  render() {
    return (
      <div>
        <Columns className="is-1_1">
          <Column className="is-5">{this.renderNodeStatus()}</Column>
          <Column className="is-7">{this.renderNodeVendorPie()}</Column>
        </Columns>
        <Columns className="is-1_1">
          <Column className="is-12">{this.renderComponentStatus()}</Column>
        </Columns>
        <Columns>
          <Column className="is-12">
            <ClusterResourceStatus cluster={this.cluster} />
            {this.supportETCD && <ETCDStatusTab cluster={this.cluster} />}
            <ServiceComponentStatus cluster={this.cluster} />
          </Column>
        </Columns>
      </div>
    )
  }
}

export default Overview
