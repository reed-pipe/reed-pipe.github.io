import { useState, useEffect, useMemo } from 'react'
import { Button, Segmented, Space, Tabs, Typography } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { useLiveQuery } from 'dexie-react-hooks'
import dayjs from 'dayjs'
import { useDb } from '@/shared/db/context'
import { useDataChanged } from '@/shared/sync/useDataChanged'
import { useBodyStore } from './store'
import WeightForm from './components/WeightForm'
import WeightChart, { type DataType } from './components/WeightChart'
import WeightTable from './components/WeightTable'
import StatsRow from './components/StatsRow'
import GoalSetting from './components/GoalSetting'
import MeasurementForm from './components/MeasurementForm'
import MeasurementChart from './components/MeasurementChart'
import CalendarHeatmap from './components/CalendarHeatmap'
import { colors, shadows } from '@/shared/theme'

const { Text } = Typography

type PeriodFilter = 'all' | 'morning' | 'evening'
type RangeFilter = 7 | 30 | 90 | 0

const periodFilterOptions = [
  { value: 'all', label: '全部' },
  { value: 'morning', label: '早晨' },
  { value: 'evening', label: '晚上' },
]

const rangeFilterOptions = [
  { value: 7, label: '近7天' },
  { value: 30, label: '近30天' },
  { value: 90, label: '近90天' },
  { value: 0, label: '全部' },
]

const dataTypeOptions = [
  { value: 'weight', label: '体重' },
  { value: 'bodyFat', label: '体脂' },
  { value: 'bmi', label: 'BMI' },
]

export default function BodyManagement() {
  const [settingOpen, setSettingOpen] = useState(false)
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all')
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>(30)
  const [dataType, setDataType] = useState<DataType>('weight')
  const { loaded, load } = useBodyStore()
  const db = useDb()
  const notifyChanged = useDataChanged()

  useEffect(() => {
    if (!loaded) void load(db)
  }, [loaded, load, db])

  const records = useLiveQuery(() =>
    db.weightRecords.orderBy('createdAt').filter(r => !r.deletedAt).toArray(), [db],
  ) ?? []

  const measurements = useLiveQuery(() =>
    db.bodyMeasurements.orderBy('createdAt').filter(r => !r.deletedAt).toArray(), [db],
  ) ?? []

  const filteredRecords = useMemo(() => {
    let result = records
    if (periodFilter !== 'all') result = result.filter((r) => r.period === periodFilter)
    if (rangeFilter > 0) {
      const cutoff = dayjs().subtract(rangeFilter, 'day').format('YYYY-MM-DD')
      result = result.filter((r) => r.date >= cutoff)
    }
    return result
  }, [records, periodFilter, rangeFilter])

  const filteredMeasurements = useMemo(() => {
    if (rangeFilter > 0) {
      const cutoff = dayjs().subtract(rangeFilter, 'day').format('YYYY-MM-DD')
      return measurements.filter((r) => r.date >= cutoff)
    }
    return measurements
  }, [measurements, rangeFilter])

  return (
    <div className="fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Record form card */}
      <div style={{
        padding: 18,
        borderRadius: 16,
        background: '#fff',
        border: `1px solid ${colors.borderLight}`,
        boxShadow: shadows.card,
      }}>
        <WeightForm onDataChanged={notifyChanged} />
      </div>

      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text strong style={{ fontSize: 16 }}>数据概览</Text>
        <Button
          type="text"
          icon={<SettingOutlined />}
          onClick={() => setSettingOpen(true)}
          style={{ borderRadius: 10 }}
        >
          设置
        </Button>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap',
        padding: '10px 14px',
        borderRadius: 12,
        background: colors.bg,
        border: `1px solid ${colors.borderLight}`,
      }}>
        <Segmented
          size="small"
          options={periodFilterOptions}
          value={periodFilter}
          onChange={(v) => setPeriodFilter(v as PeriodFilter)}
        />
        <Segmented
          size="small"
          options={rangeFilterOptions}
          value={rangeFilter}
          onChange={(v) => setRangeFilter(v as RangeFilter)}
        />
      </div>

      <StatsRow records={filteredRecords} allRecords={records} />

      <Tabs
        defaultActiveKey="chart"
        items={[
          {
            key: 'chart',
            label: '体重趋势',
            children: (
              <div>
                <Segmented
                  size="small"
                  options={dataTypeOptions}
                  value={dataType}
                  onChange={(v) => setDataType(v as DataType)}
                  style={{ marginBottom: 12 }}
                />
                <WeightChart records={filteredRecords} periodFilter={periodFilter} dataType={dataType} />
              </div>
            ),
          },
          {
            key: 'measurement',
            label: '围度趋势',
            children: (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <MeasurementForm onDataChanged={notifyChanged} />
                <MeasurementChart records={filteredMeasurements} />
              </Space>
            ),
          },
          {
            key: 'heatmap',
            label: '日历',
            children: <CalendarHeatmap records={records} />,
          },
          {
            key: 'table',
            label: '记录列表',
            children: <WeightTable onDataChanged={notifyChanged} />,
          },
        ]}
      />

      <GoalSetting open={settingOpen} onClose={() => setSettingOpen(false)} onDataChanged={notifyChanged} />
    </div>
  )
}
