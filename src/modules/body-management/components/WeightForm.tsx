import { Form, DatePicker, Select, InputNumber, Input, Button, Grid } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { db } from '@/shared/db'
import type { WeightRecord } from '@/shared/db'
import { useBodyStore } from '../store'

const { useBreakpoint } = Grid

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
  const screens = useBreakpoint()
  const isMobile = !screens.md

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

  if (isMobile) {
    return (
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ date: dayjs(), period: 'morning' }}
        style={{ marginBottom: 16 }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <Form.Item name="date" rules={[{ required: true }]} style={{ flex: 1, marginBottom: 8 }}>
            <DatePicker allowClear={false} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="period" rules={[{ required: true }]} style={{ width: 90, marginBottom: 8 }}>
            <Select options={periodOptions} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Form.Item name="weight" rules={[{ required: true, message: '请输入体重' }]} style={{ flex: 1, marginBottom: 8 }}>
            <InputNumber min={20} max={300} step={0.1} placeholder="体重 kg" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="note" style={{ flex: 1, marginBottom: 8 }}>
            <Input placeholder="备注（可选）" />
          </Form.Item>
        </div>
        <Button type="primary" htmlType="submit" icon={<PlusOutlined />} block>
          记录
        </Button>
      </Form>
    )
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
        <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
          记录
        </Button>
      </Form.Item>
    </Form>
  )
}
