import { useState, useEffect, useMemo } from 'react'
import { Button, Segmented, Space, Tabs, Typography } from 'antd'
import { SettingOutlined, UploadOutlined } from '@ant-design/icons'
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
import CsvImporter from '@/shared/components/CsvImporter'
import { useTheme } from '@/shared/hooks/useTheme'
import { ChartSkeleton, ListSkeleton } from '@/shared/components/Skeleton'

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
  const { colors, shadows } = useTheme()
  const [settingOpen, setSettingOpen] = useState(false)
  const [csvImportOpen, setCsvImportOpen] = useState(false)
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all')
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>(30)
  const [dataType, setDataType] = useState<DataType>('weight')
  const { loaded, load } = useBodyStore()
  const db = useDb()
  const notifyChanged = useDataChanged()

  useEffect(() => {
    if (!loaded) void load(db)
  }, [loaded, load, db])

  const recordsRaw = useLiveQuery(() =>
    db.weightRecords.orderBy('createdAt').filter(r => !r.deletedAt).toArray(), [db],
  )
  const records = recordsRaw ?? []

  const measurementsRaw = useLiveQuery(() =>
    db.bodyMeasurements.orderBy('createdAt').filter(r => !r.deletedAt).toArray(), [db],
  )
  const measurements = measurementsRaw ?? []
  const loading = recordsRaw === undefined

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

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ChartSkeleton height={200} />
      <ListSkeleton rows={5} />
    </div>
  )

  return (
    <div className="fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Record form card */}
      <div style={{
        padding: 18,
        borderRadius: 16,
        background: colors.bgElevated,
        border: `1px solid ${colors.borderLight}`,
        boxShadow: shadows.card,
      }}>
        <WeightForm onDataChanged={notifyChanged} />
      </div>

      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text strong style={{ fontSize: 16 }}>数据概览</Text>
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<UploadOutlined />}
            onClick={() => setCsvImportOpen(true)}
            style={{ borderRadius: 10 }}
          >
            导入
          </Button>
          <Button
            type="text"
            icon={<SettingOutlined />}
            onClick={() => setSettingOpen(true)}
            style={{ borderRadius: 10 }}
          >
            设置
          </Button>
        </Space>
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

      <CsvImporter
        open={csvImportOpen}
        onClose={() => setCsvImportOpen(false)}
        title="导入体重数据"
        fields={[
          { label: '日期', key: 'date', required: true },
          { label: '体重', key: 'weight', required: true },
          { label: '体脂', key: 'bodyFat' },
          { label: '备注', key: 'note' },
        ]}
        checkConflict={async (row) => {
          if (!row.date) return false
          const existing = await db.weightRecords.where('date').equals(row.date).count()
          return existing > 0
        }}
        onImport={async (rows) => {
          const now = Date.now()
          for (let i = 0; i < rows.length; i++) {
            const r = rows[i]!
            const weight = parseFloat(r.weight ?? '')
            if (isNaN(weight) || !r.date) continue
            await db.weightRecords.add({
              date: r.date,
              period: 'other' as const,
              weight,
              bodyFat: r.bodyFat ? parseFloat(r.bodyFat) : undefined,
              note: r.note || undefined,
              createdAt: now + i,
              updatedAt: now + i,
            })
          }
          notifyChanged()
        }}
      />
    </div>
  )
}
