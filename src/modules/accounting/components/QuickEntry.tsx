import { useState, useMemo, useEffect, useCallback } from 'react'
import { Modal, Drawer, Segmented, AutoComplete, DatePicker, Grid, message, Input, Tag } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDb } from '@/shared/db/context'
import { useDataChanged } from '@/shared/sync/useDataChanged'
import type { AccTransaction, TransactionType } from '@/shared/db'
import { useAccountingStore } from '../store'
import { parseCalcExpression, formatAmount } from '../utils'
import { colors } from '@/shared/theme'

const { useBreakpoint } = Grid

interface Props {
  open: boolean
  onClose: () => void
  ledgerId: number
  editingTransaction?: AccTransaction | null
}

const CALC_KEYS = [
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '-'],
  ['.', '0', '⌫', '+'],
]

export default function QuickEntry({ open, onClose, ledgerId, editingTransaction }: Props) {
  const db = useDb()
  const notifyChanged = useDataChanged()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const [type, setType] = useState<TransactionType>('expense')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [expression, setExpression] = useState('')
  const [note, setNote] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [date, setDate] = useState(dayjs())

  const categories = useLiveQuery(
    () => db.accCategories.where('type').equals(type).sortBy('sortOrder'),
    [db, type],
  ) ?? []

  const noteHistory = useAccountingStore(s => s.noteHistory)

  // Pre-fill when editing
  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type)
      setCategoryId(editingTransaction.categoryId)
      setExpression(String(editingTransaction.amount))
      setNote(editingTransaction.note)
      setTags(editingTransaction.tags || [])
      setDate(dayjs(editingTransaction.date))
    } else {
      setType('expense')
      setCategoryId(null)
      setExpression('')
      setNote('')
      setTags([])
      setDate(dayjs())
    }
  }, [editingTransaction, open])

  // Auto-select first category when type changes
  useEffect(() => {
    if (!editingTransaction && categories.length > 0 && categoryId === null) {
      setCategoryId(categories[0]!.id)
    }
  }, [categories, categoryId, editingTransaction])

  const parsedAmount = useMemo(() => parseCalcExpression(expression), [expression])

  const handleKeyPress = useCallback((key: string) => {
    if (key === '⌫') {
      setExpression(prev => prev.slice(0, -1))
    } else if (key === '=') {
      if (parsedAmount !== null) {
        setExpression(String(parsedAmount))
      }
    } else {
      setExpression(prev => {
        // Prevent multiple operators in a row
        const lastChar = prev[prev.length - 1]
        const isOp = (c: string) => '+-×÷'.includes(c)
        if (isOp(key) && lastChar && isOp(lastChar)) {
          return prev.slice(0, -1) + key
        }
        // Prevent multiple dots in current number
        if (key === '.') {
          const parts = prev.split(/[+\-×÷]/)
          const currentPart = parts[parts.length - 1] ?? ''
          if (currentPart.includes('.')) return prev
        }
        return prev + key
      })
    }
  }, [parsedAmount])

  const handleSubmit = async () => {
    const amount = parsedAmount
    if (!amount || amount <= 0) {
      message.warning('请输入有效金额')
      return
    }
    if (!categoryId) {
      message.warning('请选择分类')
      return
    }

    if (editingTransaction) {
      await db.accTransactions.update(editingTransaction.id, {
        type,
        categoryId,
        amount,
        note,
        tags,
        date: date.format('YYYY-MM-DD'),
      })
    } else {
      await db.accTransactions.add({
        ledgerId,
        type,
        categoryId,
        amount,
        note,
        tags,
        date: date.format('YYYY-MM-DD'),
        createdAt: Date.now(),
      })
    }

    if (note.trim()) {
      useAccountingStore.getState().addNoteHistory(note.trim(), db)
    }

    notifyChanged()
    message.success(editingTransaction ? '已更新' : '记账成功')
    onClose()
  }

  const handleAddTag = () => {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) {
      setTags([...tags, t])
    }
    setTagInput('')
  }

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', maxHeight: isMobile ? 'calc(90vh - 60px)' : undefined }}>
      {/* Type toggle */}
      <Segmented
        block
        value={type}
        onChange={v => { setType(v as TransactionType); setCategoryId(null) }}
        options={[
          { label: '支出', value: 'expense' },
          { label: '收入', value: 'income' },
        ]}
      />

      {/* Category grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
        maxHeight: 200,
        overflowY: 'auto',
      }}>
        {categories.map(cat => (
          <div
            key={cat.id}
            onClick={() => setCategoryId(cat.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '10px 4px', borderRadius: 12, cursor: 'pointer',
              background: categoryId === cat.id ? `${cat.color}15` : colors.bg,
              border: `2px solid ${categoryId === cat.id ? cat.color : 'transparent'}`,
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: 24 }}>{cat.emoji}</span>
            <span style={{ fontSize: 11, color: categoryId === cat.id ? cat.color : colors.textSecondary }}>
              {cat.name}
            </span>
          </div>
        ))}
      </div>

      {/* Amount display */}
      <div style={{
        padding: '12px 16px', borderRadius: 14,
        background: type === 'expense' ? '#FEF2F2' : '#ECFDF5',
        textAlign: 'right',
      }}>
        <div style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 4 }}>
          {parsedAmount !== null && expression.match(/[+\-×÷]/) ? `= ${formatAmount(parsedAmount)}` : ''}
        </div>
        <div style={{
          fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em',
          color: type === 'expense' ? colors.danger : colors.success,
          minHeight: 42,
        }}>
          {expression || '0'}
        </div>
      </div>

      {/* Calculator keypad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {CALC_KEYS.flat().map(key => (
          <button
            key={key}
            onClick={() => handleKeyPress(key)}
            style={{
              height: 44, border: 'none', borderRadius: 10, fontSize: 18,
              fontWeight: '+-×÷'.includes(key) ? 700 : 500,
              background: '+-×÷'.includes(key) ? colors.primaryBg : key === '⌫' ? colors.dangerBg : '#fff',
              color: '+-×÷'.includes(key) ? colors.primary : key === '⌫' ? colors.danger : colors.text,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            {key === '⌫' ? <DeleteOutlined /> : key}
          </button>
        ))}
      </div>

      {/* Note */}
      <AutoComplete
        value={note}
        onChange={setNote}
        options={noteHistory.filter(n => n.toLowerCase().includes(note.toLowerCase())).map(n => ({ value: n }))}
        placeholder="添加备注..."
        style={{ width: '100%' }}
      />

      {/* Tags */}
      <div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: tags.length ? 8 : 0 }}>
          {tags.map(t => (
            <Tag key={t} closable onClose={() => setTags(tags.filter(x => x !== t))}>{t}</Tag>
          ))}
        </div>
        <Input
          size="small"
          value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          onPressEnter={handleAddTag}
          placeholder="添加标签，回车确认"
          style={{ width: 160 }}
        />
      </div>

      {/* Date */}
      <DatePicker
        value={date}
        onChange={d => d && setDate(d)}
        allowClear={false}
        style={{ width: '100%' }}
      />

      {/* Submit */}
      <button
        onClick={handleSubmit}
        style={{
          height: 48, border: 'none', borderRadius: 14,
          background: type === 'expense'
            ? 'linear-gradient(135deg, #F5722D, #FF9A5C)'
            : 'linear-gradient(135deg, #059669, #34D399)',
          color: '#fff', fontSize: 16, fontWeight: 700,
          cursor: 'pointer',
          boxShadow: type === 'expense'
            ? '0 4px 16px rgba(245,114,45,0.3)'
            : '0 4px 16px rgba(5,150,105,0.3)',
        }}
      >
        {editingTransaction ? '更新' : '完成'}
      </button>
    </div>
  )

  const title = editingTransaction ? '编辑记录' : '记一笔'

  if (isMobile) {
    return (
      <Drawer
        title={title}
        open={open}
        onClose={onClose}
        placement="bottom"
        height="90vh"
        styles={{ body: { paddingTop: 12 } }}
      >
        {content}
      </Drawer>
    )
  }

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      footer={null}
      width={isMobile ? '92vw' : 420}
    >
      {content}
    </Modal>
  )
}
