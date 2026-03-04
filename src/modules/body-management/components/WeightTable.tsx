import { Button, Popconfirm, Table, Grid } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useDb } from '@/shared/db/context'
import type { WeightRecord } from '@/shared/db'
import { useLiveQuery } from 'dexie-react-hooks'

const { useBreakpoint } = Grid

const periodMap: Record<string, string> = {
  morning: '早晨',
  evening: '晚上',
  other: '其他',
}

interface Props {
  onDataChanged: () => void
}

export default function WeightTable({ onDataChanged }: Props) {
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const db = useDb()

  const records = useLiveQuery(() =>
    db.weightRecords.orderBy('createdAt').toArray(),
    [db],
  ) ?? []

  const handleDelete = async (id: number) => {
    await db.weightRecords.delete(id)
    onDataChanged()
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
        <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
          <Button type="link" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ]

  const mobileColumns = allColumns.filter(
    (c) => !('dataIndex' in c && (c.dataIndex === 'bmi' || c.dataIndex === 'note')),
  )

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
