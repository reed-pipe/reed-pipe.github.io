import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Grid, message } from 'antd'
import { DeleteOutlined, CloseOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDb } from '@/shared/db/context'
import { useDataChanged } from '@/shared/sync/useDataChanged'
import type { AccTransaction, TransactionType } from '@/shared/db'
import { useAccountingStore } from '../store'
import { parseCalcExpression } from '../utils'
import { useTheme } from '@/shared/hooks/useTheme'

const { useBreakpoint } = Grid

interface Props {
  open: boolean
  onClose: () => void
  ledgerId: number
  editingTransaction?: AccTransaction | null
}

export default function QuickEntry({ open, onClose, ledgerId, editingTransaction }: Props) {
  const { colors, isDark } = useTheme()
  const db = useDb()
  const notifyChanged = useDataChanged()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const dateInputRef = useRef<HTMLInputElement>(null)
  const dateInputDesktopRef = useRef<HTMLInputElement>(null)

  // Animation state
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const closingRef = useRef(false)

  useEffect(() => {
    if (open) {
      closingRef.current = false
      setMounted(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
    } else {
      setVisible(false)
      setMounted(false)
    }
  }, [open])

  const handleClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setVisible(false)
    setTimeout(() => {
      setMounted(false)
      onClose()
    }, 350)
  }, [onClose])

  const [type, setType] = useState<TransactionType>('expense')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [expression, setExpression] = useState('')
  const [remark, setRemark] = useState('')
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))

  const categories = useLiveQuery(
    () => db.accCategories.where('type').equals(type).filter(r => !r.deletedAt).sortBy('sortOrder'),
    [db, type],
  ) ?? []

  const noteHistory = useAccountingStore(s => s.noteHistory)

  useEffect(() => {
    if (!open) return
    if (editingTransaction) {
      setType(editingTransaction.type)
      setCategoryId(editingTransaction.categoryId)
      setExpression(String(editingTransaction.amount))
      setRemark(editingTransaction.note)
      setDate(editingTransaction.date)
    } else {
      setType('expense')
      setCategoryId(null)
      setExpression('')
      setRemark('')
      setDate(dayjs().format('YYYY-MM-DD'))
    }
  }, [editingTransaction, open])

  useEffect(() => {
    if (!editingTransaction && categories.length > 0 && categoryId === null) {
      setCategoryId(categories[0]!.id)
    }
  }, [categories, categoryId, editingTransaction])

  const parsedAmount = useMemo(() => parseCalcExpression(expression), [expression])

  const handleKey = useCallback((key: string) => {
    if (key === 'del') {
      setExpression(prev => prev.length > 1 ? prev.slice(0, -1) : '')
    } else if (key === '.') {
      if (!expression.includes('.')) setExpression(prev => prev + '.')
    } else if (key === '00') {
      setExpression(prev => prev === '' || prev === '0' ? prev : prev + '00')
    } else {
      setExpression(prev => {
        if (prev === '0') return key
        if (prev.includes('.')) {
          const [, dec] = prev.split('.')
          if (dec && dec.length >= 2) return prev
        }
        if (prev.length >= 9) return prev
        return prev + key
      })
    }
  }, [expression])

  const handleSave = async () => {
    const amount = parsedAmount ?? parseFloat(expression)
    if (!amount || amount <= 0) { message.warning('请输入有效金额'); return }
    if (!categoryId) { message.warning('请选择分类'); return }

    if (editingTransaction) {
      await db.accTransactions.update(editingTransaction.id, {
        type, categoryId, amount, note: remark, tags: editingTransaction.tags,
        date, updatedAt: Date.now(),
      })
    } else {
      await db.accTransactions.add({
        ledgerId, type, categoryId, amount, note: remark, tags: [],
        date, createdAt: Date.now(), updatedAt: Date.now(),
      })
    }
    if (remark.trim()) useAccountingStore.getState().addNoteHistory(remark.trim(), db)
    notifyChanged()
    message.success(editingTransaction ? '已更新' : '记账成功')
    handleClose()
  }

  const dateLabel = date === dayjs().format('YYYY-MM-DD') ? '今天'
    : date === dayjs().subtract(1, 'day').format('YYYY-MM-DD') ? '昨天'
    : date.slice(5).replace('-', '/')

  if (!mounted && !open) return null

  // ===== MOBILE LAYOUT: Bottom sheet =====
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <div
          onClick={handleClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
        />
        {/* Sheet */}
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1001,
          background: colors.bgElevated, borderRadius: '24px 24px 0 0',
          display: 'flex', flexDirection: 'column',
          height: '85vh',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.1)',
          overflow: 'hidden',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
        }}>
          {/* Drag handle */}
          <div onClick={handleClose} style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px', flexShrink: 0 }}>
            <div style={{ width: 40, height: 5, borderRadius: 3, background: colors.border }} />
          </div>

          {/* Header: type toggle + close */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 20px 12px', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', background: colors.borderLight, borderRadius: 12, padding: 3 }}>
              {(['expense', 'income'] as const).map(t => (
                <button key={t} onClick={() => { setType(t); setCategoryId(null) }} style={{
                  padding: '6px 20px', fontSize: 13, fontWeight: 600, border: 'none',
                  borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s',
                  background: type === t ? colors.bgElevated : 'transparent',
                  color: type === t ? colors.text : colors.textTertiary,
                  boxShadow: type === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}>
                  {t === 'expense' ? '支出' : '收入'}
                </button>
              ))}
            </div>
            <button onClick={handleClose} style={{
              width: 32, height: 32, borderRadius: '50%', border: 'none',
              background: colors.borderLight, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary,
            }}>
              <CloseOutlined style={{ fontSize: 14 }} />
            </button>
          </div>

          {/* Category grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 8px' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px 12px',
            }}>
              {categories.map(cat => {
                const selected = categoryId === cat.id
                return (
                  <div key={cat.id} onClick={() => setCategoryId(cat.id)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 16,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 26, transition: 'all 0.2s',
                      background: selected
                        ? (type === 'expense' ? (isDark ? '#242424' : '#18181B') : '#10B981')
                        : colors.bg,
                      boxShadow: selected
                        ? (type === 'expense' ? '0 4px 12px rgba(24,24,27,0.2)' : '0 4px 12px rgba(16,185,129,0.2)')
                        : 'none',
                      transform: selected ? 'scale(1.05)' : 'scale(1)',
                      // For selected state, apply a subtle filter to make emoji pop
                      filter: selected ? 'brightness(1.1) saturate(1.2)' : 'none',
                    }}>
                      {cat.emoji}
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: selected ? 700 : 500,
                      color: selected ? colors.text : colors.textSecondary,
                    }}>
                      {cat.name}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bottom: Amount + Remark + Keypad */}
          <div style={{
            flexShrink: 0, background: colors.bg,
            borderRadius: '24px 24px 0 0',
            boxShadow: '0 -8px 30px rgba(0,0,0,0.04)',
          }}>
            {/* Amount + remark */}
            <div style={{ padding: '16px 20px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 500, color: colors.textTertiary }}>¥</span>
                <span style={{ fontSize: 36, fontWeight: 700, color: colors.text, letterSpacing: '-0.02em' }}>
                  {expression || '0'}
                </span>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: colors.bgElevated, padding: '10px 14px', borderRadius: 14,
                border: `1px solid ${colors.borderLight}`,
              }}>
                <span style={{ fontSize: 14, color: colors.textTertiary }}>✏️</span>
                <input
                  value={remark}
                  onChange={e => setRemark(e.target.value)}
                  placeholder="添加备注..."
                  maxLength={30}
                  list="note-history"
                  style={{
                    flex: 1, border: 'none', outline: 'none', fontSize: 13,
                    color: colors.text, background: 'transparent',
                  }}
                />
                <datalist id="note-history">
                  {noteHistory.map(n => <option key={n} value={n} />)}
                </datalist>
              </div>
            </div>

            {/* Keypad */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 6, padding: '8px 16px 16px',
            }}>
              {/* Row 1 */}
              <KeyBtn onClick={() => handleKey('1')} colors={colors} isDark={isDark}>1</KeyBtn>
              <KeyBtn onClick={() => handleKey('2')} colors={colors} isDark={isDark}>2</KeyBtn>
              <KeyBtn onClick={() => handleKey('3')} colors={colors} isDark={isDark}>3</KeyBtn>
              {/* Date button */}
              <button
                type="button"
                onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
                style={{
                  background: colors.bgElevated, borderRadius: 16, minHeight: 48, border: `1px solid ${colors.borderLight}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 1, cursor: 'pointer', position: 'relative', overflow: 'hidden',
                }}
              >
                <span style={{ fontSize: 14 }}>📅</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: colors.textSecondary }}>{dateLabel}</span>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={date}
                  onChange={e => { if (e.target.value) setDate(e.target.value) }}
                  style={{
                    position: 'absolute', bottom: 0, left: 0, width: '100%', height: 1,
                    opacity: 0, pointerEvents: 'none',
                  }}
                />
              </button>

              {/* Row 2 */}
              <KeyBtn onClick={() => handleKey('4')} colors={colors} isDark={isDark}>4</KeyBtn>
              <KeyBtn onClick={() => handleKey('5')} colors={colors} isDark={isDark}>5</KeyBtn>
              <KeyBtn onClick={() => handleKey('6')} colors={colors} isDark={isDark}>6</KeyBtn>
              <KeyBtn onClick={() => handleKey('del')} color={colors.textSecondary} colors={colors} isDark={isDark}>
                <DeleteOutlined style={{ fontSize: 20 }} />
              </KeyBtn>

              {/* Row 3 */}
              <KeyBtn onClick={() => handleKey('7')} colors={colors} isDark={isDark}>7</KeyBtn>
              <KeyBtn onClick={() => handleKey('8')} colors={colors} isDark={isDark}>8</KeyBtn>
              <KeyBtn onClick={() => handleKey('9')} colors={colors} isDark={isDark}>9</KeyBtn>
              {/* 完成 button spans 2 rows */}
              <button onClick={handleSave} style={{
                gridRow: 'span 2', borderRadius: 16, border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, color: '#fff', cursor: 'pointer',
                background: type === 'expense' ? (isDark ? '#242424' : '#18181B') : '#10B981',
                boxShadow: type === 'expense'
                  ? '0 4px 12px rgba(24,24,27,0.2)'
                  : '0 4px 12px rgba(16,185,129,0.2)',
              }}>
                完成
              </button>

              {/* Row 4 */}
              <KeyBtn onClick={() => handleKey('.')} colors={colors} isDark={isDark}>.</KeyBtn>
              <KeyBtn onClick={() => handleKey('0')} colors={colors} isDark={isDark}>0</KeyBtn>
              <KeyBtn onClick={() => handleKey('00')} colors={colors} isDark={isDark}>00</KeyBtn>
            </div>

            {/* Safe area */}
            <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
          </div>
        </div>
      </>
    )
  }

  // ===== DESKTOP: Modal-like =====
  return (
    <>
      <div onClick={handleClose} style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.3)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: visible ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -48%) scale(0.96)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.3s ease, opacity 0.3s ease',
        zIndex: 1001, background: colors.bgElevated, borderRadius: 24, width: 420, maxHeight: '85vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px' }}>
          <div style={{ display: 'flex', background: colors.borderLight, borderRadius: 12, padding: 3 }}>
            {(['expense', 'income'] as const).map(t => (
              <button key={t} onClick={() => { setType(t); setCategoryId(null) }} style={{
                padding: '6px 24px', fontSize: 13, fontWeight: 600, border: 'none',
                borderRadius: 10, cursor: 'pointer',
                background: type === t ? colors.bgElevated : 'transparent',
                color: type === t ? colors.text : colors.textTertiary,
                boxShadow: type === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}>
                {t === 'expense' ? '支出' : '收入'}
              </button>
            ))}
          </div>
          <button onClick={handleClose} style={{
            width: 32, height: 32, borderRadius: '50%', border: 'none',
            background: colors.borderLight, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary,
          }}>
            <CloseOutlined style={{ fontSize: 14 }} />
          </button>
        </div>

        {/* Categories */}
        <div style={{ overflowY: 'auto', padding: '4px 20px 12px', maxHeight: 220 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px 10px' }}>
            {categories.map(cat => {
              const selected = categoryId === cat.id
              return (
                <div key={cat.id} onClick={() => setCategoryId(cat.id)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
                    background: selected ? (type === 'expense' ? (isDark ? '#242424' : '#18181B') : '#10B981') : colors.bg,
                    boxShadow: selected ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                    transform: selected ? 'scale(1.05)' : 'scale(1)', transition: 'all 0.2s',
                  }}>
                    {cat.emoji}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: selected ? 700 : 500, color: selected ? colors.text : colors.textSecondary }}>
                    {cat.name}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Amount + Remark + Keypad */}
        <div style={{ flexShrink: 0, background: colors.bg, borderRadius: '24px 24px 0 0' }}>
          <div style={{ padding: '14px 20px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 500, color: colors.textTertiary }}>¥</span>
              <span style={{ fontSize: 36, fontWeight: 700, color: colors.text }}>{expression || '0'}</span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: colors.bgElevated, padding: '10px 14px', borderRadius: 14, border: `1px solid ${colors.borderLight}`,
            }}>
              <span style={{ fontSize: 14 }}>✏️</span>
              <input value={remark} onChange={e => setRemark(e.target.value)}
                placeholder="添加备注..." maxLength={30}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, color: colors.text, background: 'transparent' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, padding: '8px 16px 16px' }}>
            <KeyBtn onClick={() => handleKey('1')} colors={colors} isDark={isDark}>1</KeyBtn>
            <KeyBtn onClick={() => handleKey('2')} colors={colors} isDark={isDark}>2</KeyBtn>
            <KeyBtn onClick={() => handleKey('3')} colors={colors} isDark={isDark}>3</KeyBtn>
            <button
              type="button"
              onClick={() => dateInputDesktopRef.current?.showPicker?.() ?? dateInputDesktopRef.current?.click()}
              style={{
                background: colors.bgElevated, borderRadius: 16, minHeight: 48, border: `1px solid ${colors.borderLight}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 1, cursor: 'pointer', position: 'relative', overflow: 'hidden',
              }}
            >
              <span style={{ fontSize: 14 }}>📅</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: colors.textSecondary }}>{dateLabel}</span>
              <input
                ref={dateInputDesktopRef}
                type="date"
                value={date}
                onChange={e => { if (e.target.value) setDate(e.target.value) }}
                style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 1, opacity: 0, pointerEvents: 'none' }}
              />
            </button>
            <KeyBtn onClick={() => handleKey('4')} colors={colors} isDark={isDark}>4</KeyBtn>
            <KeyBtn onClick={() => handleKey('5')} colors={colors} isDark={isDark}>5</KeyBtn>
            <KeyBtn onClick={() => handleKey('6')} colors={colors} isDark={isDark}>6</KeyBtn>
            <KeyBtn onClick={() => handleKey('del')} color={colors.textSecondary} colors={colors} isDark={isDark}><DeleteOutlined style={{ fontSize: 20 }} /></KeyBtn>
            <KeyBtn onClick={() => handleKey('7')} colors={colors} isDark={isDark}>7</KeyBtn>
            <KeyBtn onClick={() => handleKey('8')} colors={colors} isDark={isDark}>8</KeyBtn>
            <KeyBtn onClick={() => handleKey('9')} colors={colors} isDark={isDark}>9</KeyBtn>
            <button onClick={handleSave} style={{
              gridRow: 'span 2', borderRadius: 16, border: 'none',
              fontSize: 16, fontWeight: 700, color: '#fff', cursor: 'pointer',
              background: type === 'expense' ? (isDark ? '#242424' : '#18181B') : '#10B981',
              boxShadow: type === 'expense' ? '0 4px 12px rgba(24,24,27,0.2)' : '0 4px 12px rgba(16,185,129,0.2)',
            }}>
              完成
            </button>
            <KeyBtn onClick={() => handleKey('.')} colors={colors} isDark={isDark}>.</KeyBtn>
            <KeyBtn onClick={() => handleKey('0')} colors={colors} isDark={isDark}>0</KeyBtn>
            <KeyBtn onClick={() => handleKey('00')} colors={colors} isDark={isDark}>00</KeyBtn>
          </div>
        </div>
      </div>
    </>
  )
}

function KeyBtn({ children, onClick, color, colors, isDark }: {
  children: React.ReactNode; onClick: () => void; color?: string;
  colors?: { bgElevated: string; borderLight: string; text: string; bg: string };
  isDark?: boolean;
}) {
  const bgColor = colors?.bgElevated ?? '#fff'
  const pressedBg = colors?.bg ?? '#FAFAFA'
  const borderColor = colors?.borderLight ?? '#F4F4F5'
  const textColor = color ?? colors?.text ?? '#18181B'
  return (
    <button onClick={onClick} style={{
      background: bgColor, borderRadius: 16, border: `1px solid ${borderColor}`,
      padding: '12px 0', fontSize: 22, fontWeight: 600,
      color: textColor, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.1s',
    }}
      onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.95)'; e.currentTarget.style.background = pressedBg }}
      onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = bgColor }}
      onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = bgColor }}
    >
      {children}
    </button>
  )
}
