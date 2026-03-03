import { Button, Popconfirm, Table, Grid } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { db, type WeightRecord } from '@/shared/db'

const { useBreakpoint } = Grid

const periodMap: Record<string, string> = {
  morning: '早晨',
  evening: '晚上',
  other: '其他',
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
    title: '备注',
    dataIndex: 'note',
    render: (v?: string) => v || '-',
  },
  {
    title: '',
    width: 50,
    render: (_, record) => (
      <Popconfirm title="确认删除？" onConfirm={() => db.weightRecords.delete(record.id)}>
        <Button type="link" danger icon={<DeleteOutlined />} size="small" />
      </Popconfirm>
    ),
  },
]

// 移动端隐藏 BMI、备注列
const mobileColumns = allColumns.filter(
  (c) => !('dataIndex' in c && (c.dataIndex === 'bmi' || c.dataIndex === 'note')),
)

interface Props {
  records: WeightRecord[]
}

export default function WeightTable({ records }: Props) {
  const screens = useBreakpoint()
  const isMobile = !screens.md

  return (
    <Table<WeightRecord>
      rowKey="id"
      columns={isMobile ? mobileColumns : allColumns}
      dataSource={records}
      size="small"
      scroll={isMobile ? { x: 'max-content' } : undefined}
      pagination={{
        pageSize: isMobile ? 10 : 15,
        showSizeChanger: !isMobile,
        showTotal: isMobile ? undefined : (t) => `共 ${t} 条`,
        simple: isMobile,
      }}
    />
  )
}
