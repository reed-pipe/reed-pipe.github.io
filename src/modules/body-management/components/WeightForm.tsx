import { useState } from 'react'
import { Form, DatePicker, Select, InputNumber, Input, Button, Grid, Modal } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useDb } from '@/shared/db/context'
import type { WeightRecord } from '@/shared/db'
import { useBodyStore } from '../store'
import { calculateBMI, detectPeriod } from '../utils'

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
  bodyFat?: number
  note?: string
}

interface Props {
  onDataChanged: () => void
}

const disabledFutureDate = (d: dayjs.Dayjs) => d.isAfter(dayjs(), 'day')

export default function WeightForm({ onDataChanged }: Props) {
  const [form] = Form.useForm<FormValues>()
  const [submitting, setSubmitting] = useState(false)
  const height = useBodyStore((s) => s.height)
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const db = useDb()

  const resetForm = () => {
    form.resetFields()
    form.setFieldsValue({ date: dayjs(), period: detectPeriod() })
  }

  const handleSubmit = async (values: FormValues) => {
    if (submitting) return
    setSubmitting(true)
    const weight = values.weight
    const dateStr = values.date.format('YYYY-MM-DD')
    const bmi = height ? calculateBMI(weight, height) : undefined

    // 检查同一天同一时段是否已有记录
    const existing = await db.weightRecords
      .where('date')
      .equals(dateStr)
      .filter((r) => r.period === values.period)
      .first()

    if (existing) {
      Modal.confirm({
        title: '记录已存在',
        content: `已存在该时段记录（${existing.weight} kg），是否覆盖？`,
        okText: '覆盖',
        cancelText: '取消',
        onOk: async () => {
          await db.weightRecords.update(existing.id, {
            weight,
            bmi,
            bodyFat: values.bodyFat ?? undefined,
            note: values.note || undefined,
            updatedAt: Date.now(),
          })
          onDataChanged()
          resetForm()
        },
        afterClose: () => setSubmitting(false),
      })
      return
    }

    await db.weightRecords.add({
      date: dateStr,
      period: values.period,
      weight,
      bmi,
      bodyFat: values.bodyFat ?? undefined,
      note: values.note || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    onDataChanged()
    resetForm()
    setSubmitting(false)
  }

  if (isMobile) {
    return (
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ date: dayjs(), period: detectPeriod() }}
        style={{ marginBottom: 16 }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <Form.Item name="date" rules={[{ required: true }]} style={{ flex: 1, marginBottom: 8 }}>
            <DatePicker allowClear={false} style={{ width: '100%' }} disabledDate={disabledFutureDate} />
          </Form.Item>
          <Form.Item name="period" rules={[{ required: true }]} style={{ width: 90, marginBottom: 8 }}>
            <Select options={periodOptions} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Form.Item name="weight" rules={[{ required: true, message: '请输入体重' }]} style={{ flex: 1, marginBottom: 8 }}>
            <InputNumber min={20} max={300} step={0.1} precision={1} placeholder="体重 kg" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="bodyFat" style={{ flex: 1, marginBottom: 8 }}>
            <InputNumber min={1} max={60} step={0.1} precision={1} placeholder="体脂率 %（可选）" style={{ width: '100%' }} />
          </Form.Item>
        </div>
        <Form.Item name="note" style={{ marginBottom: 8 }}>
          <Input placeholder="备注（可选）" />
        </Form.Item>
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
      initialValues={{ date: dayjs(), period: detectPeriod() }}
      style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}
    >
      <Form.Item name="date" rules={[{ required: true }]}>
        <DatePicker allowClear={false} disabledDate={disabledFutureDate} />
      </Form.Item>
      <Form.Item name="period" rules={[{ required: true }]}>
        <Select options={periodOptions} style={{ width: 90 }} />
      </Form.Item>
      <Form.Item name="weight" rules={[{ required: true, message: '请输入体重' }]}>
        <InputNumber min={20} max={300} step={0.1} precision={1} placeholder="体重 kg" style={{ width: 120 }} />
      </Form.Item>
      <Form.Item name="bodyFat">
        <InputNumber min={1} max={60} step={0.1} precision={1} placeholder="体脂 %" style={{ width: 100 }} />
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
