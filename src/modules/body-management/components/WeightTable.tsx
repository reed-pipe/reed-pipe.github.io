import { Button, Popconfirm, Table } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { db, type WeightRecord } from '@/shared/db'

const periodMap: Record<string, string> = {
  morning: '早晨',
  evening: '晚上',
  other: '其他',
}

const columns: ColumnsType<WeightRecord> = [
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
    title: '体重 (kg)',
    dataIndex: 'weight',
    sorter: (a, b) => a.weight - b.weight,
  },
  {
    title: 'BMI',
    dataIndex: 'bmi',
    render: (v?: number) => (v != null ? v.toFixed(1) : '-'),
  },
  {
    title: '备注',
    dataIndex: 'note',
    render: (v?: string) => v || '-',
  },
  {
    title: '操作',
    width: 80,
    render: (_, record) => (
      <Popconfirm title="确认删除此记录？" onConfirm={() => db.weightRecords.delete(record.id)}>
        <Button type="link" danger icon={<DeleteOutlined />} size="small" />
      </Popconfirm>
    ),
  },
]

interface Props {
  records: WeightRecord[]
}

export default function WeightTable({ records }: Props) {
  return (
    <Table<WeightRecord>
      rowKey="id"
      columns={columns}
      dataSource={records}
      size="small"
      pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
    />
  )
}
