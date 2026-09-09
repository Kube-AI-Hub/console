import React from 'react'
import { get, isEmpty, isEqual, isArray, cloneDeep } from 'lodash'

import { Loading } from '@kube-design/components'

import EmptyList from 'components/Cards/EmptyList'
import MonitorTab from './MonitorTab'
import {
  METER_RESOURCE_TITLE,
  METER_RESOURCE_USAGE_TITLE,
} from '../../constats'
import * as styles from './index.scss'

export default class LineChart extends React.Component {
  state = {
    chartData: [],
    loading: false,
  }

  shouldComponentUpdate(nextProps, nextState) {
    return (
      this.state.loading !== nextState.loading ||
      !isEqual(this.props.chartData, nextProps.chartData)
    )
  }

  componentDidMount() {
    if (!isEmpty(this.props.chartData)) {
      this.setAreaChartData(this.props.chartData)
    }
  }

  componentDidUpdate(prevProps) {
    if (!isEqual(this.props.chartData, prevProps.chartData)) {
      this.setAreaChartData(this.props.chartData)
    }
  }

  setAreaChartData = data => {
    this.setState({ loading: true }, () => {
      if (isEmpty(data)) {
        this.setState({ loading: false, chartData: [] })
        return
      }

      const chartData = cloneDeep(data).filter(
        item => METER_RESOURCE_TITLE[item.type]
      )
      chartData.forEach(item => {
        item.title = METER_RESOURCE_TITLE[item.type]
      })

      this.setState({
        chartData,
        loading: false,
      })
    })
  }

  renderUsageChart = () => {
    const { chartData } = this.state
    if (isEmpty(chartData) || !isArray(chartData)) {
      return null
    }

    const METER_ICON = {
      CPU: 'cpu',
      Memory: 'memory',
      'GPU Usage': 'gpu',
      'GPU Memory Usage': 'gpu',
      'GPU Allocation Count': 'gpu',
      Volumes: 'storage',
      'Net Received': 'network',
      'Net Transmitted': 'network',
    }

    const tabs = chartData.map(item => {
      const unitLabel = get(item, 'unit.label', get(item, 'unit.value', ''))
      const unitValue = get(item, 'unit.value', unitLabel)
      return {
        key: item.title,
        icon: METER_ICON[item.title],
        unit: unitValue,
        displayUnit: unitLabel,
        legend: [item.title],
        title: t(
          METER_RESOURCE_USAGE_TITLE[item.type]
            .toUpperCase()
            .replace(/\s+/g, '_')
        ),
        data: [item],
        yAxis: true,
        titleValue: item.sum_value,
        dot: 3,
      }
    })

    return <MonitorTab tabs={tabs} />
  }

  render() {
    return (
      <div className={styles.chartContainer}>
        <Loading spinning={this.state.loading}>
          {isEmpty(this.state.chartData) ? (
            <EmptyList
              className="no-shadow"
              icon="exclamation"
              title={t('NO_DATA')}
              desc={t('NO_RESOURCE_FOUND')}
            />
          ) : (
            this.renderUsageChart()
          )}
        </Loading>
      </div>
    )
  }
}
