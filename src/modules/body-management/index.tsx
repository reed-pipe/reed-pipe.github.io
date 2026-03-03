import { useState, useEffect } from 'react'
import { Button, Space, Tabs } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/shared/db'
import { useBodyStore } from './store'
import WeightForm from './components/WeightForm'
import WeightChart from './components/WeightChart'
import WeightTable from './components/WeightTable'
import StatsRow from './components/StatsRow'
import GoalSetting from './components/GoalSetting'

export default function BodyManagement() {
  const [settingOpen, setSettingOpen] = useState(false)
  const { loaded, load } = useBodyStore()

  useEffect(() => {
    if (!loaded) {
      void load()
    }
  }, [loaded, load])

  const records = useLiveQuery(() =>
    db.weightRecords.orderBy('createdAt').toArray(),
  ) ?? []

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button icon={<SettingOutlined />} onClick={() => setSettingOpen(true)}>
          设置
        </Button>
      </div>

      <StatsRow records={records} />
      <WeightForm />

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
            children: <WeightTable records={records} />,
          },
        ]}
      />

      <GoalSetting open={settingOpen} onClose={() => setSettingOpen(false)} />
    </Space>
  )
}
