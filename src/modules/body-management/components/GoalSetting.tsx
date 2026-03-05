import { useEffect } from 'react'
import { Modal, Form, InputNumber, Button, Space, message } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { useDb } from '@/shared/db/context'
import { useBodyStore } from '../store'
import { exportWeightCSV, exportMeasurementCSV } from '../utils'

interface Props {
  open: boolean
  onClose: () => void
  onDataChanged: () => void
}

function downloadCSV(content: string, filename: string) {
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function GoalSetting({ open, onClose, onDataChanged }: Props) {
  const { height, goalWeight, setHeight, setGoalWeight } = useBodyStore()
  const [form] = Form.useForm<{ height: number | null; goalWeight: number | null }>()
  const db = useDb()

  useEffect(() => {
    if (open) {
      form.setFieldsValue({ height, goalWeight })
    }
  }, [open, height, goalWeight, form])

  const handleOk = async () => {
    const values = await form.validateFields()
    await setHeight(values.height, db)
    await setGoalWeight(values.goalWeight, db)
    onDataChanged()
    onClose()
  }

  const handleExportWeight = async () => {
    const records = await db.weightRecords.toArray()
    if (records.length === 0) {
      message.warning('暂无体重数据可导出')
      return
    }
    const csv = exportWeightCSV(records)
    downloadCSV(csv, `体重记录_${new Date().toISOString().slice(0, 10)}.csv`)
    message.success('导出成功')
  }

  const handleExportMeasurement = async () => {
    const records = await db.bodyMeasurements.toArray()
    if (records.length === 0) {
      message.warning('暂无围度数据可导出')
      return
    }
    const csv = exportMeasurementCSV(records)
    downloadCSV(csv, `围度记录_${new Date().toISOString().slice(0, 10)}.csv`)
    message.success('导出成功')
  }

  return (
    <Modal title="身材设置" open={open} onOk={handleOk} onCancel={onClose} destroyOnClose>
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="height" label="身高 (cm)">
          <InputNumber min={50} max={250} step={0.1} precision={1} style={{ width: '100%' }} placeholder="输入身高以自动计算 BMI" />
        </Form.Item>
        <Form.Item name="goalWeight" label="目标体重 (kg)">
          <InputNumber min={20} max={300} step={0.1} precision={1} style={{ width: '100%' }} placeholder="设置后图表会显示目标线" />
        </Form.Item>
      </Form>

      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16, marginTop: 8 }}>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>数据导出</div>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleExportWeight}>导出体重 CSV</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExportMeasurement}>导出围度 CSV</Button>
        </Space>
      </div>
    </Modal>
  )
}
