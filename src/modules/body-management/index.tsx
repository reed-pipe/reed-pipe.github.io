import { useState, useEffect, useMemo } from 'react'
import { Button, Segmented, Space, Tabs } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { useLiveQuery } from 'dexie-react-hooks'
import dayjs from 'dayjs'
import { useDb } from '@/shared/db/context'
import { useDataChanged } from '@/shared/sync/useDataChanged'
import { useBodyStore } from './store'
import WeightForm from './components/WeightForm'
import WeightChart from './components/WeightChart'
import WeightTable from './components/WeightTable'
import StatsRow from './components/StatsRow'
import GoalSetting from './components/GoalSetting'

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

export default function BodyManagement() {
  const [settingOpen, setSettingOpen] = useState(false)
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all')
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>(30)
  const { loaded, load } = useBodyStore()
  const db = useDb()
  const notifyChanged = useDataChanged()

  useEffect(() => {
    if (!loaded) {
      void load(db)
    }
  }, [loaded, load, db])

  const records = useLiveQuery(() =>
    db.weightRecords.orderBy('createdAt').toArray(),
    [db],
  ) ?? []

  const filteredRecords = useMemo(() => {
    let result = records
    if (periodFilter !== 'all') {
      result = result.filter((r) => r.period === periodFilter)
    }
    if (rangeFilter > 0) {
      const cutoff = dayjs().subtract(rangeFilter, 'day').format('YYYY-MM-DD')
      result = result.filter((r) => r.date >= cutoff)
    }
    return result
  }, [records, periodFilter, rangeFilter])

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <WeightForm onDataChanged={notifyChanged} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 500, fontSize: 15 }}>数据概览</span>
        <Button type="text" icon={<SettingOutlined />} onClick={() => setSettingOpen(true)}>
          设置
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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

      <StatsRow records={filteredRecords} />

      <Tabs
        defaultActiveKey="chart"
        items={[
          {
            key: 'chart',
            label: '趋势图',
            children: <WeightChart records={filteredRecords} />,
          },
          {
            key: 'table',
            label: '记录列表',
            children: <WeightTable onDataChanged={notifyChanged} />,
          },
        ]}
      />

      <GoalSetting open={settingOpen} onClose={() => setSettingOpen(false)} onDataChanged={notifyChanged} />
    </Space>
  )
}
