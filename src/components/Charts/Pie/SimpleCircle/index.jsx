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
import PropTypes from 'prop-types'
import classnames from 'classnames'
import { get, isEmpty } from 'lodash'

import { getColorByName } from 'utils/monitoring'
import variables from '~scss/variables.module.scss'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Sector,
  Tooltip,
  Legend,
} from 'recharts'

import * as styles from './index.scss'

const AreaColors = ['green']

export default class SimpleCircle extends React.Component {
  static propTypes = {
    theme: PropTypes.oneOf(['light', 'dark']),
    width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    title: PropTypes.string,
    legend: PropTypes.array,
    value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    total: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    unit: PropTypes.string,
    areaColors: PropTypes.array,
    showCenter: PropTypes.bool,
    showRate: PropTypes.bool,
    showRatio: PropTypes.bool,
    active: PropTypes.bool,
  }

  static defaultProps = {
    theme: 'light',
    width: 100,
    height: 100,
    title: '',
    legend: ['USED', 'TOTAL'],
    value: 0,
    total: 0,
    unit: '',
    areaColors: AreaColors,
    showCenter: true,
    showRate: false,
    showRatio: true,
    active: false,
  }

  constructor(props) {
    super(props)

    this.state = {
      ...this.getFills(props),
    }
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.active !== this.props.active ||
      prevProps.value !== this.props.value ||
      prevProps.total !== this.props.total ||
      prevProps.showRate !== this.props.showRate ||
      prevProps.areaColors !== this.props.areaColors
    ) {
      this.setState({
        ...this.getFills(this.props),
      })
    }
  }

  get rawValue() {
    const value = parseFloat(this.props.value || 0)
    return Number.isFinite(value) && value > 0 ? value : 0
  }

  get total() {
    const total = parseFloat(this.props.total || 0)
    return Number.isFinite(total) && total > 0 ? total : 0
  }

  get value() {
    return this.total ? Math.min(this.rawValue, this.total) : 0
  }

  get remain() {
    const remain = this.total - this.value
    return this.total === 0 ? 1 : remain
  }

  getRate = (num = 1) =>
    this.total ? ((this.value / this.total) * 100).toFixed(num) : 0

  getPrimaryColor = props => {
    const { areaColors, active, showRate } = props || {}
    const rate = this.getRate()
    let colorName = ''
    let colorValue = getColorByName(get(areaColors, [0], variables.white))

    if (showRate) {
      if (active) {
        colorName = 'white'
        colorValue = variables.white
      }
      if (rate >= 80) {
        colorName = 'yellow'
        colorValue = variables.yellowColor03
      }
      if (rate >= 90) {
        colorName = 'red'
        colorValue = variables.redColor03
      }
    }
    return { colorName, colorValue }
  }

  getFills = props => {
    const { areaColors, active } = props || {}
    const activeFill = {
      fill: this.getPrimaryColor(props).colorValue,
    }

    const totalFillColor = areaColors[1]
      ? getColorByName(areaColors[1])
      : variables.white

    const totalFill = active
      ? {
          fill: variables.white,
          fillOpacity: 0.2,
        }
      : {
          fill: totalFillColor,
          fillOpacity: areaColors[1] ? 1 : 0.35,
        }

    return { activeFill, totalFill }
  }

  getData = () => [
    {
      name: this.props.legend[0],
      value: this.value,
      ...this.state.activeFill,
      fillOpacity: this.state.activeFill.fillOpacity || 1,
    },
    {
      name: 'Remaining',
      value: this.remain,
      ...this.state.totalFill,
      fillOpacity: this.state.totalFill.fillOpacity || 1,
    },
  ]

  renderCenter() {
    const {
      theme,
      value,
      total,
      showRate,
      showRatio,
      renderCustomCenter,
    } = this.props
    const { colorName } = this.getPrimaryColor(this.props)

    const extra = showRate
      ? {
          [styles.standard]: true,
        }
      : showRatio
      ? {
          [styles.mid]: value > 99 || total > 99,
          [styles.mini]: value > 999 || total > 999,
        }
      : {}
    const content = showRate ? (
      `${this.getRate(0)}%`
    ) : showRatio ? (
      <p>
        <strong>{value}</strong>
        <span>/</span>
        {total}
      </p>
    ) : null

    return (
      <div
        className={classnames(styles.center, styles[colorName], extra, {
          [styles.white]: theme === 'dark',
        })}
      >
        {renderCustomCenter ? renderCustomCenter({ value, total }) : content}
      </div>
    )
  }

  renderActiveShape = (props = {}) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle } = props

    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          {...this.state.activeFill}
        />
      </g>
    )
  }

  renderTooltip = ({ active }) => {
    if (!active) return null

    const { title, legend, unit, value, total, showRate } = this.props
    const unitText = unit === '%' ? '%' : ` ${unit}`
    const rateText = showRate && ` (${this.getRate()}%)`

    return (
      <div className={styles.tooltip}>
        <div className={styles.label}>{t(title)}</div>
        <div className={styles.list}>
          <div className={styles.item}>
            <i
              style={{
                background: this.state.activeFill.fill,
              }}
            />
            <label>{t(legend[0])}:</label>
            <p>
              {value}
              {unitText}
              {rateText}
            </p>
          </div>
          <div className={styles.item}>
            <i style={{ background: variables.white }} />
            <label>{t(legend[1])}:</label>
            <p>
              {total}
              {unitText}
            </p>
          </div>
        </div>
      </div>
    )
  }

  renderLegend() {
    const { legend, areaColors } = this.props

    return (
      <Legend
        wrapperStyle={{
          bottom: 0,
          zIndex: 100,
        }}
        content={({ payload }) => {
          const data = [...payload]

          if (!isEmpty(data)) {
            data[data.length - 1].value = legend[legend.length - 1]
            data[data.length - 1].color =
              areaColors[data.length - 1] || variables.white
          }

          return (
            <div className={styles.legend}>
              {data.map(item => {
                const color = get(item, 'payload.fill')
                return (
                  <div
                    key={item.dataKey}
                    data-key={item.dataKey}
                    className={styles.item}
                  >
                    <i style={{ backgroundColor: color }} />
                    {t(item.value)}
                  </div>
                )
              })}
            </div>
          )
        }}
      />
    )
  }

  render() {
    const { width, height, showCenter, innerRadius = '70%' } = this.props
    const data = this.getData()

    return (
      <div className={styles.chart} style={{ width, height }}>
        {showCenter && this.renderCenter()}
        <ResponsiveContainer width="100%" height="100%" debounce={1}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={innerRadius}
              outerRadius="100%"
              stroke="transparent"
            >
              {data.map(item => (
                <Cell
                  key={item.name}
                  fill={item.fill}
                  fillOpacity={item.fillOpacity}
                />
              ))}
            </Pie>
            <Tooltip
              wrapperStyle={{ zIndex: 100 }}
              content={this.renderTooltip}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }
}
