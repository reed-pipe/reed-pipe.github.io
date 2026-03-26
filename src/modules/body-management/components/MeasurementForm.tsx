import { Form, DatePicker, InputNumber, Input, Button, Grid } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useDb } from '@/shared/db/context'

const { useBreakpoint } = Grid

interface FormValues {
  date: dayjs.Dayjs
  waist?: number
  hip?: number
  chest?: number
  leftArm?: number
  rightArm?: number
  leftThigh?: number
  rightThigh?: number
  note?: string
}

interface Props {
  onDataChanged: () => void
}

const disabledFutureDate = (d: dayjs.Dayjs) => d.isAfter(dayjs(), 'day')

const fields = [
  { name: 'waist', label: '腰围', placeholder: '腰围 cm' },
  { name: 'hip', label: '臀围', placeholder: '臀围 cm' },
  { name: 'chest', label: '胸围', placeholder: '胸围 cm' },
  { name: 'leftArm', label: '左臂围', placeholder: '左臂围 cm' },
  { name: 'rightArm', label: '右臂围', placeholder: '右臂围 cm' },
  { name: 'leftThigh', label: '左腿围', placeholder: '左腿围 cm' },
  { name: 'rightThigh', label: '右腿围', placeholder: '右腿围 cm' },
] as const

export default function MeasurementForm({ onDataChanged }: Props) {
  const [form] = Form.useForm<FormValues>()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const db = useDb()

  const handleSubmit = async (values: FormValues) => {
    const hasAny = fields.some((f) => values[f.name] != null)
    if (!hasAny) return

    await db.bodyMeasurements.add({
      date: values.date.format('YYYY-MM-DD'),
      waist: values.waist ?? undefined,
      hip: values.hip ?? undefined,
      chest: values.chest ?? undefined,
      leftArm: values.leftArm ?? undefined,
      rightArm: values.rightArm ?? undefined,
      leftThigh: values.leftThigh ?? undefined,
      rightThigh: values.rightThigh ?? undefined,
      note: values.note || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    onDataChanged()
    form.resetFields()
    form.setFieldsValue({ date: dayjs() })
  }

  return (
    <Form
      form={form}
      layout={isMobile ? 'vertical' : 'inline'}
      onFinish={handleSubmit}
      initialValues={{ date: dayjs() }}
      style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}
    >
      <Form.Item name="date" rules={[{ required: true }]} style={isMobile ? { marginBottom: 8 } : undefined}>
        <DatePicker allowClear={false} disabledDate={disabledFutureDate} style={isMobile ? { width: '100%' } : undefined} />
      </Form.Item>

      {isMobile ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {fields.map((f) => (
            <Form.Item key={f.name} name={f.name} style={{ marginBottom: 8 }}>
              <InputNumber min={10} max={200} step={0.1} precision={1} placeholder={f.placeholder} style={{ width: '100%' }} />
            </Form.Item>
          ))}
        </div>
      ) : (
        fields.map((f) => (
          <Form.Item key={f.name} name={f.name}>
            <InputNumber min={10} max={200} step={0.1} precision={1} placeholder={f.placeholder} style={{ width: 110 }} />
          </Form.Item>
        ))
      )}

      <Form.Item name="note" style={isMobile ? { marginBottom: 8 } : undefined}>
        <Input placeholder="备注（可选）" style={isMobile ? { width: '100%' } : { width: 120 }} />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" icon={<PlusOutlined />} block={isMobile}>
          记录
        </Button>
      </Form.Item>
    </Form>
  )
}
