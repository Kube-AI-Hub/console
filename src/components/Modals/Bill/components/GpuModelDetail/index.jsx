import React, { useMemo, useState } from 'react'
import { get, isArray, isEmpty, isUndefined } from 'lodash'
import { Select } from '@kube-design/components'
import Table from 'components/Tables/Base'
import { SimpleArea } from 'components/Charts'
import EmptyList from 'components/Cards/EmptyList'
import { getAreaChartOps } from 'utils/monitoring'
import { fillEmptyMeterValue } from 'utils/meter'
import { getMinuteValue } from 'stores/monitoring/base'
import { getVendorDisplayName } from 'utils'
import { UNIT_CONFIG } from '../../constats'
import * as styles from './index.scss'

const METRIC_OPTIONS = [
  { value: 'gpu_allocated', labelKey: 'METER_GPU_ALLOCATED' },
  { value: 'gpu', labelKey: 'METER_GPU_USAGE' },
  { value: 'gpu_memory', labelKey: 'METER_GPU_MEMORY_USAGE' },
]

const modelKey = item => {
  const model = get(item, 'metric.model') || t('UNKNOWN_GPU_MODEL')
  const vendor = get(item, 'metric.vendor') || ''
  return `${vendor}::${model}`
}

const GpuModelDetail = ({
  data = [],
  priceConfig = {},
  loading,
  timeRange = {},
  totalData = [],
}) => {
  const [metric, setMetric] = useState('gpu_allocated')
  const [selectedKey, setSelectedKey] = useState('all')

  const rows = useMemo(() => {
    if (isEmpty(data)) {
      return []
    }
    const grouped = {}
    data.forEach(item => {
      const key = modelKey(item)
      if (!grouped[key]) {
        grouped[key] = {
          key,
          model: get(item, 'metric.model') || t('UNKNOWN_GPU_MODEL'),
          vendor: get(item, 'metric.vendor') || '-',
          gpu: {},
          gpu_memory: {},
          gpu_allocated: {},
        }
      }
      if (item.type === 'gpu_usage_by_model') {
        grouped[key].gpu = item
      }
      if (item.type === 'gpu_memory_usage_by_model') {
        grouped[key].gpu_memory = item
      }
      if (item.type === 'gpu_allocated_by_model') {
        grouped[key].gpu_allocated = item
      }
    })
    return Object.values(grouped)
  }, [data])

  if (isEmpty(rows) && !loading) {
    return null
  }

  const modelOptions = [
    { label: t('ALL'), value: 'all' },
    ...rows.map(row => ({
      label: row.model,
      value: row.key,
    })),
  ]

  const visibleRows =
    selectedKey === 'all' ? rows : rows.filter(row => row.key === selectedKey)

  const showFee = !isEmpty(priceConfig)
  const seriesLength = Math.max(
    0,
    ...rows.map(row => get(row, 'gpu_allocated.values.length', 0))
  )
  const showHistoryHint = seriesLength > 0 && seriesLength < 24

  const formatNumber = value => {
    if (isUndefined(value) || value === '' || value === null) {
      return '-'
    }
    return value
  }

  const renderStat = (record, type) => {
    const item = record[type]
    if (isEmpty(item)) {
      return '-'
    }
    const unit = get(item, 'unit.label', get(UNIT_CONFIG[type], 'label', ''))
    const sum = formatNumber(get(item, 'sum_value'))
    const avg = formatNumber(get(item, 'avg_value'))
    const max = formatNumber(get(item, 'max_value'))
    return (
      <>
        <div>
          {sum} {unit}
        </div>
        <p>
          {t('AVERAGE_USAGE')} {avg} / {t('MAXIMUM_USAGE')} {max}
        </p>
      </>
    )
  }

  const columns = [
    {
      title: t('GPU_CARD_MODEL'),
      dataIndex: 'model',
    },
    {
      title: t('GPU_CARD_VENDOR'),
      dataIndex: 'vendor',
      render: value => getVendorDisplayName(value) || value || '-',
    },
    {
      title: t('METER_GPU_USAGE'),
      dataIndex: 'gpu',
      render: (_, record) => renderStat(record, 'gpu'),
    },
    {
      title: t('METER_GPU_MEMORY_USAGE'),
      dataIndex: 'gpu_memory',
      render: (_, record) => renderStat(record, 'gpu_memory'),
    },
    {
      title: t('METER_GPU_ALLOCATED'),
      dataIndex: 'gpu_allocated',
      render: (_, record) => renderStat(record, 'gpu_allocated'),
    },
    ...(showFee
      ? [
          {
            title: t('PRICE'),
            dataIndex: 'fee',
            render: (_, record) => {
              const fee = get(record, 'gpu_allocated.fee', 0)
              const unit = priceConfig.currency || ''
              return `${unit} ${parseFloat(fee || 0).toFixed(2)}`
            },
          },
        ]
      : []),
  ]

  const startSec = timeRange.start
    ? Math.floor(Number(timeRange.start) / 1000)
    : 0
  const endSec = timeRange.end ? Math.floor(Number(timeRange.end) / 1000) : 0
  const stepSec = timeRange.step ? getMinuteValue(timeRange.step, false) : 3600

  const totalItem = (isArray(totalData) ? totalData : []).find(
    item => item.type === metric
  )
  const useTotalSeries =
    rows.length === 1 &&
    !isEmpty(get(totalItem, 'values')) &&
    get(totalItem, 'values.length', 0) > 1

  const chartSeries = visibleRows
    .map(row => {
      const item = row[metric]
      if (isEmpty(item) || (isEmpty(item.values) && !useTotalSeries)) {
        return null
      }
      const rawValues = (item.values || []).map(point => [
        point[0],
        point[1] === '-1' ? null : point[1],
      ])
      const totalValues = useTotalSeries
        ? (totalItem.values || []).map(point => [
            point[0],
            point[1] === '-1' ? null : point[1],
          ])
        : null
      return {
        ...item,
        title: row.model,
        values:
          totalValues ||
          (startSec && endSec
            ? fillEmptyMeterValue(
                { start: startSec, end: endSec, step: stepSec },
                rawValues
              )
            : rawValues),
      }
    })
    .filter(Boolean)

  const chartConfig =
    chartSeries.length > 0
      ? getAreaChartOps({
          title: t(METRIC_OPTIONS.find(item => item.value === metric).labelKey),
          unit: get(
            chartSeries[0],
            'unit.label',
            get(UNIT_CONFIG[metric], 'label', '')
          ),
          legend: chartSeries.map(item => item.title),
          data: chartSeries,
          dot: 3,
        })
      : null

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>{t('GPU_MODEL_CONSUMPTION')}</div>
          <div className={styles.desc}>
            {t('GPU_MODEL_CONSUMPTION_DESC')}
            {showHistoryHint ? ` ${t('GPU_MODEL_HISTORY_HINT')}` : ''}
          </div>
        </div>
        <div className={styles.toolbar}>
          <Select
            value={metric}
            onChange={setMetric}
            options={METRIC_OPTIONS.map(item => ({
              value: item.value,
              label: t(item.labelKey),
            }))}
          />
          <Select
            value={selectedKey}
            onChange={setSelectedKey}
            options={modelOptions}
          />
        </div>
      </div>
      {isEmpty(rows) ? (
        <EmptyList
          className={styles.empty}
          icon="gpu"
          title={t('NO_GPU_METER_DATA')}
          desc={t('NO_GPU_METER_DATA_DESC')}
        />
      ) : (
        <div className={styles.body}>
          <div className={styles.tableWrap}>
            <Table
              hideHeader
              hideFooter
              rowKey="key"
              data={visibleRows}
              columns={columns}
              loading={loading}
              onRow={record => ({
                className:
                  selectedKey === record.key ? styles.rowActive : undefined,
                onClick: () =>
                  setSelectedKey(
                    selectedKey === record.key ? 'all' : record.key
                  ),
              })}
            />
          </div>
          <div className={styles.chartWrap}>
            {chartConfig ? (
              <SimpleArea width="100%" height={220} {...chartConfig} />
            ) : (
              <EmptyList
                className={styles.empty}
                icon="gpu"
                title={t('NO_DATA')}
                desc={t('NO_RESOURCE_FOUND')}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default GpuModelDetail
