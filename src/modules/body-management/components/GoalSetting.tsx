import { useEffect } from 'react'
import { Modal, Form, InputNumber } from 'antd'
import { useDb } from '@/shared/db/context'
import { useBodyStore } from '../store'

interface Props {
  open: boolean
  onClose: () => void
  onDataChanged: () => void
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
    </Modal>
  )
}
