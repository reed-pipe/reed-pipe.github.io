import { Form, DatePicker, Select, InputNumber, Input, Button, Space } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { db } from '@/shared/db'
import type { WeightRecord } from '@/shared/db'
import { useBodyStore } from '../store'

const periodOptions = [
  { value: 'morning', label: '早晨' },
  { value: 'evening', label: '晚上' },
  { value: 'other', label: '其他' },
]

interface FormValues {
  date: dayjs.Dayjs
  period: WeightRecord['period']
  weight: number
  note?: string
}

export default function WeightForm() {
  const [form] = Form.useForm<FormValues>()
  const height = useBodyStore((s) => s.height)

  const handleSubmit = async (values: FormValues) => {
    const weight = values.weight
    const bmi = height ? +(weight / (height / 100) ** 2).toFixed(1) : undefined

    await db.weightRecords.add({
      date: values.date.format('YYYY-MM-DD'),
      period: values.period,
      weight,
      bmi,
      note: values.note || undefined,
      createdAt: Date.now(),
    })

    form.resetFields()
    form.setFieldsValue({ date: dayjs(), period: 'morning' })
  }

  return (
    <Form
      form={form}
      layout="inline"
      onFinish={handleSubmit}
      initialValues={{ date: dayjs(), period: 'morning' }}
      style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}
    >
      <Form.Item name="date" rules={[{ required: true }]}>
        <DatePicker allowClear={false} />
      </Form.Item>
      <Form.Item name="period" rules={[{ required: true }]}>
        <Select options={periodOptions} style={{ width: 90 }} />
      </Form.Item>
      <Form.Item name="weight" rules={[{ required: true, message: '请输入体重' }]}>
        <InputNumber min={20} max={300} step={0.1} placeholder="体重 kg" style={{ width: 120 }} />
      </Form.Item>
      <Form.Item name="note">
        <Input placeholder="备注（可选）" style={{ width: 140 }} />
      </Form.Item>
      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
            记录
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )
}
