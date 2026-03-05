import { useState } from 'react'
import { Button, Popconfirm, Table, Grid, Modal, Form, DatePicker, Select, InputNumber, Input } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useDb } from '@/shared/db/context'
import type { WeightRecord } from '@/shared/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { useBodyStore } from '../store'
import { calculateBMI } from '../utils'

const { useBreakpoint } = Grid

const periodMap: Record<string, string> = {
  morning: '早晨',
  evening: '晚上',
  other: '其他',
}

const periodOptions = [
  { value: 'morning', label: '早晨' },
  { value: 'evening', label: '晚上' },
  { value: 'other', label: '其他' },
]

interface EditFormValues {
  date: dayjs.Dayjs
  period: WeightRecord['period']
  weight: number
  bodyFat?: number
  note?: string
}

interface Props {
  onDataChanged: () => void
}

export default function WeightTable({ onDataChanged }: Props) {
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const db = useDb()
  const height = useBodyStore((s) => s.height)
  const [editingRecord, setEditingRecord] = useState<WeightRecord | null>(null)
  const [editForm] = Form.useForm<EditFormValues>()

  const records = useLiveQuery(() =>
    db.weightRecords.orderBy('createdAt').toArray(),
    [db],
  ) ?? []

  const handleDelete = async (id: number) => {
    await db.weightRecords.delete(id)
    onDataChanged()
  }

  const openEdit = (record: WeightRecord) => {
    setEditingRecord(record)
  }

  const handleEditOk = async () => {
    const values = await editForm.validateFields()
    if (!editingRecord) return
    const bmi = height ? calculateBMI(values.weight, height) : undefined
    await db.weightRecords.update(editingRecord.id, {
      date: values.date.format('YYYY-MM-DD'),
      period: values.period,
      weight: values.weight,
      bmi,
      bodyFat: values.bodyFat ?? undefined,
      note: values.note || undefined,
    })
    onDataChanged()
    setEditingRecord(null)
  }

  const allColumns: ColumnsType<WeightRecord> = [
    {
      title: '日期',
      dataIndex: 'date',
      sorter: (a, b) => a.date.localeCompare(b.date),
      defaultSortOrder: 'descend',
    },
    {
      title: '时段',
      dataIndex: 'period',
      render: (v: string) => periodMap[v] ?? v,
      filters: [
        { text: '早晨', value: 'morning' },
        { text: '晚上', value: 'evening' },
        { text: '其他', value: 'other' },
      ],
      onFilter: (value, record) => record.period === value,
    },
    {
      title: '体重',
      dataIndex: 'weight',
      render: (v: number) => `${v} kg`,
      sorter: (a, b) => a.weight - b.weight,
    },
    {
      title: 'BMI',
      dataIndex: 'bmi',
      render: (v?: number) => (v != null ? v.toFixed(1) : '-'),
    },
    {
      title: '体脂',
      dataIndex: 'bodyFat',
      render: (v?: number) => (v != null ? `${v}%` : '-'),
    },
    {
      title: '备注',
      dataIndex: 'note',
      render: (v?: string) => v || '-',
    },
    {
      title: '',
      width: 50,
      render: (_, record) => (
        <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
          <Button type="link" danger icon={<DeleteOutlined />} size="small" onClick={(e) => e.stopPropagation()} />
        </Popconfirm>
      ),
    },
  ]

  const mobileColumns = allColumns.filter(
    (c) => !('dataIndex' in c && (c.dataIndex === 'bmi' || c.dataIndex === 'note' || c.dataIndex === 'bodyFat')),
  )

  return (
    <>
      <Table<WeightRecord>
        rowKey="id"
        columns={isMobile ? mobileColumns : allColumns}
        dataSource={records}
        size="small"
        scroll={isMobile ? { x: 'max-content' } : undefined}
        onRow={(record) => ({ onClick: () => openEdit(record), style: { cursor: 'pointer' } })}
        pagination={{
          pageSize: isMobile ? 10 : 15,
          showSizeChanger: !isMobile,
          showTotal: isMobile ? undefined : (t) => `共 ${t} 条`,
          simple: isMobile,
        }}
      />

      <Modal
        title="编辑记录"
        open={editingRecord !== null}
        onOk={handleEditOk}
        onCancel={() => setEditingRecord(null)}
        afterOpenChange={(open) => {
          if (open && editingRecord) {
            editForm.setFieldsValue({
              date: dayjs(editingRecord.date),
              period: editingRecord.period,
              weight: editingRecord.weight,
              bodyFat: editingRecord.bodyFat,
              note: editingRecord.note,
            })
          } else if (!open) {
            editForm.resetFields()
          }
        }}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="date" label="日期" rules={[{ required: true }]}>
            <DatePicker allowClear={false} style={{ width: '100%' }} disabledDate={(d) => d.isAfter(dayjs(), 'day')} />
          </Form.Item>
          <Form.Item name="period" label="时段" rules={[{ required: true }]}>
            <Select options={periodOptions} />
          </Form.Item>
          <Form.Item name="weight" label="体重 (kg)" rules={[{ required: true, message: '请输入体重' }]}>
            <InputNumber min={20} max={300} step={0.1} precision={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="bodyFat" label="体脂率 (%)">
            <InputNumber min={1} max={60} step={0.1} precision={1} style={{ width: '100%' }} placeholder="可选" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input placeholder="备注（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
