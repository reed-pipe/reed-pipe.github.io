import { useState, useMemo, useEffect, useCallback } from 'react'
import { Modal, Segmented, AutoComplete, DatePicker, Grid, message, Input, Tag } from 'antd'
import { DeleteOutlined, CalendarOutlined } from '@ant-design/icons'
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
  const [showExtra, setShowExtra] = useState(false)

  const categories = useLiveQuery(
    () => db.accCategories.where('type').equals(type).sortBy('sortOrder'),
    [db, type],
  ) ?? []

  const noteHistory = useAccountingStore(s => s.noteHistory)

  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type)
      setCategoryId(editingTransaction.categoryId)
      setExpression(String(editingTransaction.amount))
      setNote(editingTransaction.note)
      setTags(editingTransaction.tags || [])
      setDate(dayjs(editingTransaction.date))
      setShowExtra(true)
    } else {
      setType('expense')
      setCategoryId(null)
      setExpression('')
      setNote('')
      setTags([])
      setDate(dayjs())
      setShowExtra(false)
    }
  }, [editingTransaction, open])

  useEffect(() => {
    if (!editingTransaction && categories.length > 0 && categoryId === null) {
      setCategoryId(categories[0]!.id)
    }
  }, [categories, categoryId, editingTransaction])

  const parsedAmount = useMemo(() => parseCalcExpression(expression), [expression])
  const hasOperator = /[+\-×÷]/.test(expression)

  const handleKeyPress = useCallback((key: string) => {
    if (key === '⌫') {
      setExpression(prev => prev.slice(0, -1))
    } else if (key === '=') {
      if (parsedAmount !== null) setExpression(String(parsedAmount))
    } else {
      setExpression(prev => {
        const lastChar = prev[prev.length - 1]
        const isOp = (c: string) => '+-×÷'.includes(c)
        if (isOp(key) && lastChar && isOp(lastChar)) return prev.slice(0, -1) + key
        if (key === '.') {
          const parts = prev.split(/[+\-×÷]/)
          if ((parts[parts.length - 1] ?? '').includes('.')) return prev
        }
        return prev + key
      })
    }
  }, [parsedAmount])

  const handleSubmit = async () => {
    const amount = parsedAmount
    if (!amount || amount <= 0) { message.warning('请输入有效金额'); return }
    if (!categoryId) { message.warning('请选择分类'); return }

    if (editingTransaction) {
      await db.accTransactions.update(editingTransaction.id, {
        type, categoryId, amount, note, tags, date: date.format('YYYY-MM-DD'),
      })
    } else {
      await db.accTransactions.add({
        ledgerId, type, categoryId, amount, note, tags,
        date: date.format('YYYY-MM-DD'), createdAt: Date.now(),
      })
    }
    if (note.trim()) useAccountingStore.getState().addNoteHistory(note.trim(), db)
    notifyChanged()
    message.success(editingTransaction ? '已更新' : '记账成功')
    onClose()
  }

  const handleAddTag = () => {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagInput('')
  }

  const selectedCat = categories.find(c => c.id === categoryId)

  // ===== MOBILE LAYOUT: full screen bottom sheet =====
  if (isMobile) {
    return (
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: open ? 'flex' : 'none', flexDirection: 'column',
          background: '#fff',
        }}
      >
        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px 8px', flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 15, color: colors.textSecondary,
            cursor: 'pointer', padding: '4px 0',
          }}>
            取消
          </button>
          <Segmented
            size="small"
            value={type}
            onChange={v => { setType(v as TransactionType); setCategoryId(null) }}
            options={[
              { label: '支出', value: 'expense' },
              { label: '收入', value: 'income' },
            ]}
          />
          <button onClick={() => setShowExtra(!showExtra)} style={{
            background: 'none', border: 'none', fontSize: 12, color: colors.primary,
            cursor: 'pointer', padding: '4px 0',
          }}>
            {showExtra ? '收起' : '更多'}
          </button>
        </div>

        {/* Category scroll */}
        <div style={{
          overflowX: 'auto', flexShrink: 0,
          padding: '4px 12px 8px',
          WebkitOverflowScrolling: 'touch',
        }}>
          <div style={{ display: 'flex', gap: 6, minWidth: 'max-content' }}>
            {categories.map(cat => {
              const selected = categoryId === cat.id
              return (
                <div
                  key={cat.id}
                  onClick={() => setCategoryId(cat.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 2, padding: '6px 10px', borderRadius: 10, cursor: 'pointer',
                    background: selected ? `${cat.color}15` : 'transparent',
                    border: `1.5px solid ${selected ? cat.color : 'transparent'}`,
                    minWidth: 52, transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 22 }}>{cat.emoji}</span>
                  <span style={{
                    fontSize: 10, whiteSpace: 'nowrap',
                    color: selected ? cat.color : colors.textSecondary,
                    fontWeight: selected ? 600 : 400,
                  }}>
                    {cat.name}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Extra fields: note, date, tags */}
        {showExtra && (
          <div style={{ padding: '0 16px 6px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <AutoComplete
                value={note}
                onChange={setNote}
                options={noteHistory.filter(n => n.toLowerCase().includes(note.toLowerCase())).map(n => ({ value: n }))}
                placeholder="备注..."
                style={{ flex: 1 }}
                size="small"
              />
              <DatePicker
                value={date}
                onChange={d => d && setDate(d)}
                allowClear={false}
                size="small"
                style={{ width: 105 }}
                suffixIcon={<CalendarOutlined style={{ fontSize: 12 }} />}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              {tags.map(t => (
                <Tag key={t} closable onClose={() => setTags(tags.filter(x => x !== t))} style={{ margin: 0, fontSize: 11 }}>{t}</Tag>
              ))}
              <Input
                size="small"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onPressEnter={handleAddTag}
                placeholder="标签+回车"
                style={{ width: 90, fontSize: 12 }}
              />
            </div>
          </div>
        )}

        {/* Amount display - takes remaining space */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'flex-end',
          padding: '0 20px', minHeight: 60,
        }}>
          {hasOperator && parsedAmount !== null && (
            <div style={{ fontSize: 13, color: colors.textTertiary, marginBottom: 2 }}>
              = {formatAmount(parsedAmount)}
            </div>
          )}
          <div style={{
            fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em',
            color: type === 'expense' ? colors.danger : colors.success,
          }}>
            ¥{expression || '0'}
          </div>
          {selectedCat && (
            <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
              {selectedCat.emoji} {selectedCat.name}
              {note ? ` · ${note}` : ''}
            </div>
          )}
        </div>

        {/* Calculator keypad - pinned bottom */}
        <div style={{ flexShrink: 0, padding: '0 8px 8px' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
          }}>
            {['7','8','9','÷','4','5','6','×','1','2','3','-','.','0','⌫','+'].map(key => (
              <button
                key={key}
                onClick={() => handleKeyPress(key)}
                style={{
                  height: 48, border: 'none', borderRadius: 12, fontSize: 20,
                  fontWeight: '+-×÷'.includes(key) ? 700 : 500,
                  background: '+-×÷'.includes(key) ? colors.primaryBg : key === '⌫' ? '#F3F4F6' : '#fff',
                  color: '+-×÷'.includes(key) ? colors.primary : key === '⌫' ? colors.textSecondary : colors.text,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                {key === '⌫' ? <DeleteOutlined style={{ fontSize: 18 }} /> : key}
              </button>
            ))}
          </div>

          {/* Bottom row: = or submit */}
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {hasOperator && (
              <button
                onClick={() => handleKeyPress('=')}
                style={{
                  flex: 1, height: 48, border: 'none', borderRadius: 12,
                  fontSize: 18, fontWeight: 600,
                  background: '#F3F4F6', color: colors.text,
                  cursor: 'pointer',
                }}
              >
                =
              </button>
            )}
            <button
              onClick={handleSubmit}
              style={{
                flex: hasOperator ? 2 : 1, height: 48, border: 'none', borderRadius: 12,
                fontSize: 16, fontWeight: 700,
                background: type === 'expense'
                  ? 'linear-gradient(135deg, #F5722D, #FF9A5C)'
                  : 'linear-gradient(135deg, #059669, #34D399)',
                color: '#fff', cursor: 'pointer',
                boxShadow: type === 'expense'
                  ? '0 2px 12px rgba(245,114,45,0.3)'
                  : '0 2px 12px rgba(5,150,105,0.3)',
              }}
            >
              {editingTransaction ? '更新' : parsedAmount && parsedAmount > 0 ? `记一笔 ¥${formatAmount(parsedAmount)}` : '记一笔'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ===== DESKTOP LAYOUT: Modal =====
  const desktopContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Segmented
        block
        value={type}
        onChange={v => { setType(v as TransactionType); setCategoryId(null) }}
        options={[
          { label: '支出', value: 'expense' },
          { label: '收入', value: 'income' },
        ]}
      />

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
        maxHeight: 200, overflowY: 'auto',
      }}>
        {categories.map(cat => (
          <div
            key={cat.id}
            onClick={() => setCategoryId(cat.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 4, padding: '10px 4px', borderRadius: 12, cursor: 'pointer',
              background: categoryId === cat.id ? `${cat.color}15` : colors.bg,
              border: `2px solid ${categoryId === cat.id ? cat.color : 'transparent'}`,
            }}
          >
            <span style={{ fontSize: 24 }}>{cat.emoji}</span>
            <span style={{ fontSize: 11, color: categoryId === cat.id ? cat.color : colors.textSecondary }}>
              {cat.name}
            </span>
          </div>
        ))}
      </div>

      {/* Amount */}
      <div style={{
        padding: '12px 16px', borderRadius: 12,
        background: type === 'expense' ? '#FEF2F2' : '#ECFDF5', textAlign: 'right',
      }}>
        <div style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 2 }}>
          {parsedAmount !== null && hasOperator ? `= ${formatAmount(parsedAmount)}` : ''}
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, color: type === 'expense' ? colors.danger : colors.success, minHeight: 42 }}>
          {expression || '0'}
        </div>
      </div>

      {/* Keypad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {['7','8','9','÷','4','5','6','×','1','2','3','-','.','0','⌫','+'].map(key => (
          <button
            key={key}
            onClick={() => handleKeyPress(key)}
            style={{
              height: 44, border: 'none', borderRadius: 10, fontSize: 18,
              fontWeight: '+-×÷'.includes(key) ? 700 : 500,
              background: '+-×÷'.includes(key) ? colors.primaryBg : key === '⌫' ? colors.dangerBg : '#fff',
              color: '+-×÷'.includes(key) ? colors.primary : key === '⌫' ? colors.danger : colors.text,
              cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            {key === '⌫' ? <DeleteOutlined /> : key}
          </button>
        ))}
        {hasOperator && (
          <button
            onClick={() => handleKeyPress('=')}
            style={{
              gridColumn: '1 / -1', height: 38, border: 'none', borderRadius: 10,
              fontSize: 16, fontWeight: 600,
              background: colors.primaryBg, color: colors.primary, cursor: 'pointer',
            }}
          >
            = {parsedAmount !== null ? formatAmount(parsedAmount) : ''}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <AutoComplete
          value={note} onChange={setNote}
          options={noteHistory.filter(n => n.toLowerCase().includes(note.toLowerCase())).map(n => ({ value: n }))}
          placeholder="备注..." style={{ flex: 1 }}
        />
        <DatePicker value={date} onChange={d => d && setDate(d)} allowClear={false} style={{ width: 130 }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {tags.map(t => (
          <Tag key={t} closable onClose={() => setTags(tags.filter(x => x !== t))} style={{ margin: 0 }}>{t}</Tag>
        ))}
        <Input
          size="small" value={tagInput}
          onChange={e => setTagInput(e.target.value)} onPressEnter={handleAddTag}
          placeholder="标签+回车" style={{ width: 100 }}
        />
      </div>

      <button
        onClick={handleSubmit}
        style={{
          height: 48, border: 'none', borderRadius: 14,
          background: type === 'expense'
            ? 'linear-gradient(135deg, #F5722D, #FF9A5C)'
            : 'linear-gradient(135deg, #059669, #34D399)',
          color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
          boxShadow: type === 'expense' ? '0 4px 16px rgba(245,114,45,0.3)' : '0 4px 16px rgba(5,150,105,0.3)',
        }}
      >
        {editingTransaction ? '更新' : parsedAmount && parsedAmount > 0 ? `记一笔 ¥${formatAmount(parsedAmount)}` : '完成'}
      </button>
    </div>
  )

  return (
    <Modal
      title={editingTransaction ? '编辑记录' : '记一笔'}
      open={open}
      onCancel={onClose}
      footer={null}
      width={420}
    >
      {desktopContent}
    </Modal>
  )
}
