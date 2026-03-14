import { useState, useMemo, useEffect, useCallback } from 'react'
import { Modal, Segmented, AutoComplete, DatePicker, Grid, message, Input, Tag } from 'antd'
import { DeleteOutlined, CalendarOutlined, LeftOutlined } from '@ant-design/icons'
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

type Step = 'category' | 'amount'

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
  const [step, setStep] = useState<Step>('category')

  const categories = useLiveQuery(
    () => db.accCategories.where('type').equals(type).sortBy('sortOrder'),
    [db, type],
  ) ?? []

  const noteHistory = useAccountingStore(s => s.noteHistory)

  useEffect(() => {
    if (!open) return
    if (editingTransaction) {
      setType(editingTransaction.type)
      setCategoryId(editingTransaction.categoryId)
      setExpression(String(editingTransaction.amount))
      setNote(editingTransaction.note)
      setTags(editingTransaction.tags || [])
      setDate(dayjs(editingTransaction.date))
      setStep('amount')
    } else {
      setType('expense')
      setCategoryId(null)
      setExpression('')
      setNote('')
      setTags([])
      setDate(dayjs())
      setStep('category')
    }
  }, [editingTransaction, open])

  const parsedAmount = useMemo(() => parseCalcExpression(expression), [expression])
  const hasOperator = /[+\-×÷]/.test(expression)
  const selectedCat = categories.find(c => c.id === categoryId)

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

  const handleSelectCategory = (catId: number) => {
    setCategoryId(catId)
    setStep('amount')
  }

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

  // ===== MOBILE: Full-screen two-step flow =====
  if (isMobile) {
    if (!open) return null

    // --- STEP 1: Category Selection ---
    if (step === 'category') {
      return (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', flexDirection: 'column',
          background: '#FFF8E1',
        }}>
          {/* Top bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 10px', flexShrink: 0,
          }}>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', fontSize: 15,
              color: '#8D6E00', cursor: 'pointer', padding: '4px 0',
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
              style={{ background: 'rgba(255,255,255,0.6)' }}
            />
            <div style={{ width: 36 }} />
          </div>

          {/* Category grid */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '8px 12px',
            WebkitOverflowScrolling: 'touch',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
            }}>
              {categories.map(cat => {
                const selected = categoryId === cat.id
                return (
                  <div
                    key={cat.id}
                    onClick={() => handleSelectCategory(cat.id)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 6, padding: '12px 4px', cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      width: 52, height: 52, borderRadius: '50%',
                      background: selected ? cat.color : 'rgba(255,255,255,0.85)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 26,
                      boxShadow: selected
                        ? `0 4px 12px ${cat.color}40`
                        : '0 2px 8px rgba(0,0,0,0.06)',
                      transition: 'all 0.15s',
                    }}>
                      {cat.emoji}
                    </div>
                    <span style={{
                      fontSize: 12, color: selected ? cat.color : '#5D4E00',
                      fontWeight: selected ? 600 : 400,
                    }}>
                      {cat.name}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )
    }

    // --- STEP 2: Amount Entry ---
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', flexDirection: 'column',
        background: '#fff',
      }}>
        {/* Top bar: back + category info + date */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '12px 12px 8px', flexShrink: 0,
          borderBottom: `1px solid ${colors.borderLight}`,
        }}>
          <button onClick={() => setStep('category')} style={{
            background: 'none', border: 'none', fontSize: 18,
            color: colors.textSecondary, cursor: 'pointer', padding: '4px 8px 4px 0',
            display: 'flex', alignItems: 'center',
          }}>
            <LeftOutlined />
          </button>
          {/* Selected category - tappable to go back */}
          <div
            onClick={() => setStep('category')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              flex: 1, cursor: 'pointer',
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: selectedCat ? `${selectedCat.color}15` : '#f5f5f5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20,
            }}>
              {selectedCat?.emoji ?? '💰'}
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>
              {selectedCat?.name ?? '选择分类'}
            </span>
          </div>
          <DatePicker
            value={date}
            onChange={d => d && setDate(d)}
            allowClear={false}
            size="small"
            style={{ width: 105 }}
            suffixIcon={<CalendarOutlined style={{ fontSize: 12 }} />}
          />
        </div>

        {/* Amount display area */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', padding: '0 20px',
        }}>
          {/* Amount */}
          <div style={{ textAlign: 'right' }}>
            {hasOperator && parsedAmount !== null && (
              <div style={{ fontSize: 14, color: colors.textTertiary, marginBottom: 4 }}>
                = {formatAmount(parsedAmount)}
              </div>
            )}
            <div style={{
              fontSize: 42, fontWeight: 800, letterSpacing: '-0.02em',
              color: type === 'expense' ? colors.danger : colors.success,
              lineHeight: 1.1,
            }}>
              {expression || '0'}
            </div>
          </div>

          {/* Note inline */}
          <div style={{ marginTop: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <AutoComplete
              value={note}
              onChange={setNote}
              options={noteHistory.filter(n => n.toLowerCase().includes(note.toLowerCase())).map(n => ({ value: n }))}
              placeholder="添加备注..."
              size="small"
              style={{ flex: 1 }}
              variant="borderless"
            />
          </div>

          {/* Tags inline */}
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            {tags.map(t => (
              <Tag key={t} closable onClose={() => setTags(tags.filter(x => x !== t))}
                style={{ margin: 0, fontSize: 11, borderRadius: 6 }}>{t}</Tag>
            ))}
            <Input
              size="small" value={tagInput}
              onChange={e => setTagInput(e.target.value)} onPressEnter={handleAddTag}
              placeholder="标签回车" variant="borderless"
              style={{ width: 80, fontSize: 12 }}
            />
          </div>
        </div>

        {/* Calculator keypad */}
        <div style={{
          flexShrink: 0, padding: '4px 6px',
          background: '#F7F7F8', borderTop: `1px solid ${colors.borderLight}`,
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5,
          }}>
            {['7','8','9','⌫','4','5','6','+','1','2','3','-','.','0','=','×'].map(key => {
              const isOp = '+-×÷'.includes(key)
              const isDelete = key === '⌫'
              const isEquals = key === '='

              return (
                <button
                  key={key}
                  onClick={() => handleKeyPress(key)}
                  style={{
                    height: 50, border: 'none', borderRadius: 10, fontSize: 20,
                    fontWeight: isOp ? 700 : 500,
                    background: isOp ? '#FFE0B2' : isEquals ? '#E3F2FD' : isDelete ? '#FFEBEE' : '#fff',
                    color: isOp ? '#E65100' : isEquals ? '#1565C0' : isDelete ? colors.danger : colors.text,
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  }}
                >
                  {isDelete ? <DeleteOutlined style={{ fontSize: 18 }} /> : key}
                </button>
              )
            })}
          </div>

          {/* Submit row */}
          <div style={{ marginTop: 5 }}>
            <button
              onClick={handleSubmit}
              style={{
                width: '100%', height: 50, border: 'none', borderRadius: 10,
                fontSize: 17, fontWeight: 700,
                background: type === 'expense'
                  ? 'linear-gradient(135deg, #F5722D, #FF9A5C)'
                  : 'linear-gradient(135deg, #059669, #34D399)',
                color: '#fff', cursor: 'pointer',
                boxShadow: type === 'expense'
                  ? '0 2px 12px rgba(245,114,45,0.3)'
                  : '0 2px 12px rgba(5,150,105,0.3)',
              }}
            >
              {editingTransaction ? '更新' : parsedAmount && parsedAmount > 0 ? `完成 ¥${formatAmount(parsedAmount)}` : '完成'}
            </button>
          </div>

          {/* Safe area spacer for iPhone */}
          <div style={{ height: 'env(safe-area-inset-bottom, 8px)' }} />
        </div>
      </div>
    )
  }

  // ===== DESKTOP: Modal (unchanged) =====
  const desktopContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Segmented
        block value={type}
        onChange={v => { setType(v as TransactionType); setCategoryId(null) }}
        options={[{ label: '支出', value: 'expense' }, { label: '收入', value: 'income' }]}
      />

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
        maxHeight: 200, overflowY: 'auto',
      }}>
        {categories.map(cat => (
          <div
            key={cat.id} onClick={() => setCategoryId(cat.id)}
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {['7','8','9','÷','4','5','6','×','1','2','3','-','.','0','⌫','+'].map(key => (
          <button
            key={key} onClick={() => handleKeyPress(key)}
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
          <button onClick={() => handleKeyPress('=')} style={{
            gridColumn: '1 / -1', height: 38, border: 'none', borderRadius: 10,
            fontSize: 16, fontWeight: 600,
            background: colors.primaryBg, color: colors.primary, cursor: 'pointer',
          }}>
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
        <Input size="small" value={tagInput}
          onChange={e => setTagInput(e.target.value)} onPressEnter={handleAddTag}
          placeholder="标签+回车" style={{ width: 100 }}
        />
      </div>

      <button onClick={handleSubmit} style={{
        height: 48, border: 'none', borderRadius: 14,
        background: type === 'expense'
          ? 'linear-gradient(135deg, #F5722D, #FF9A5C)'
          : 'linear-gradient(135deg, #059669, #34D399)',
        color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
        boxShadow: type === 'expense' ? '0 4px 16px rgba(245,114,45,0.3)' : '0 4px 16px rgba(5,150,105,0.3)',
      }}>
        {editingTransaction ? '更新' : parsedAmount && parsedAmount > 0 ? `记一笔 ¥${formatAmount(parsedAmount)}` : '完成'}
      </button>
    </div>
  )

  return (
    <Modal
      title={editingTransaction ? '编辑记录' : '记一笔'}
      open={open} onCancel={onClose} footer={null} width={420}
    >
      {desktopContent}
    </Modal>
  )
}
