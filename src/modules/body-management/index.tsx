import { useState, useEffect } from 'react'
import { Button, Space, Tabs } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDb } from '@/shared/db/context'
import { useDataChanged } from '@/shared/sync/useDataChanged'
import { useBodyStore } from './store'
import WeightForm from './components/WeightForm'
import WeightChart from './components/WeightChart'
import WeightTable from './components/WeightTable'
import StatsRow from './components/StatsRow'
import GoalSetting from './components/GoalSetting'

export default function BodyManagement() {
  const [settingOpen, setSettingOpen] = useState(false)
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

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <WeightForm onDataChanged={notifyChanged} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 500, fontSize: 15 }}>数据概览</span>
        <Button type="text" icon={<SettingOutlined />} onClick={() => setSettingOpen(true)}>
          设置
        </Button>
      </div>

      <StatsRow records={records} />

      <Tabs
        defaultActiveKey="chart"
        items={[
          {
            key: 'chart',
            label: '趋势图',
            children: <WeightChart records={records} />,
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
