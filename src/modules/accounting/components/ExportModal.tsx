import { useState } from 'react'
import { Modal, DatePicker, message, Grid } from 'antd'
import dayjs from 'dayjs'
import { useDb } from '@/shared/db/context'
import { exportAccountingCSV } from '../utils'

const { RangePicker } = DatePicker
const { useBreakpoint } = Grid

interface Props {
  open: boolean
  onClose: () => void
  ledgerId: number
}

export default function ExportModal({ open, onClose, ledgerId }: Props) {
  const db = useDb()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)

  const handleExport = async () => {
    let transactions
    if (range) {
      const start = range[0].format('YYYY-MM-DD')
      const end = range[1].format('YYYY-MM-DD')
      transactions = await db.accTransactions
        .where('[ledgerId+date]')
        .between([ledgerId, start], [ledgerId, end + '\uffff'])
        .toArray()
    } else {
      transactions = await db.accTransactions
        .where('ledgerId').equals(ledgerId)
        .toArray()
    }

    if (transactions.length === 0) {
      message.warning('所选范围内没有记录')
      return
    }

    const categories = await db.accCategories.toArray()
    const csv = exportAccountingCSV(transactions, categories)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const label = range
      ? `${range[0].format('YYYY-MM-DD')}_${range[1].format('YYYY-MM-DD')}`
      : '全部'
    a.download = `记账_${label}.csv`
    a.click()
    URL.revokeObjectURL(url)
    message.success(`已导出 ${transactions.length} 条记录`)
    onClose()
  }

  return (
    <Modal
      title="导出 CSV"
      open={open}
      onCancel={onClose}
      onOk={handleExport}
      okText="导出"
      width={isMobile ? '92vw' : 400}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
        <div style={{ fontSize: 13, color: '#6B7280' }}>
          选择日期范围（留空则导出全部记录）
        </div>
        <RangePicker
          value={range}
          onChange={dates => {
            if (dates?.[0] && dates?.[1]) {
              setRange([dates[0], dates[1]])
            } else {
              setRange(null)
            }
          }}
          style={{ width: '100%' }}
          allowClear
        />
      </div>
    </Modal>
  )
}
