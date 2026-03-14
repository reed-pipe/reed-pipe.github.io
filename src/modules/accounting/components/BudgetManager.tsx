import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Grid, message } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDb } from '@/shared/db/context'
import { useDataChanged } from '@/shared/sync/useDataChanged'
import { getMonthRange, formatAmount } from '../utils'

const { useBreakpoint } = Grid

interface Props {
  ledgerId: number
  yearMonth: string
}

function budgetColor(percent: number): string {
  if (percent >= 90) return '#EF4444'
  if (percent >= 70) return '#F59E0B'
  return '#18181B'
}

export default function BudgetManager({ ledgerId, yearMonth }: Props) {
  const db = useDb()
  const notifyChanged = useDataChanged()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [totalBudgetInput, setTotalBudgetInput] = useState('')
  const [categoryBudgets, setCategoryBudgets] = useState<Record<number, string>>({})

  // Animation
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const closingRef = useRef(false)

  useEffect(() => {
    if (settingsOpen) {
      closingRef.current = false
      setMounted(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else {
      setVisible(false)
      setMounted(false)
    }
  }, [settingsOpen])

  const handleCloseSettings = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setVisible(false)
    setTimeout(() => { setMounted(false); setSettingsOpen(false) }, 350)
  }, [])

  const { start, end } = useMemo(() => getMonthRange(yearMonth), [yearMonth])

  const budgets = useLiveQuery(
    () => db.accBudgets.where('yearMonth').equals(yearMonth).toArray(),
    [db, yearMonth],
  ) ?? []

  const prevMonthKey = useMemo(() => {
    const [y, m] = yearMonth.split('-').map(Number) as [number, number]
    const pm = m === 1 ? 12 : m - 1
    const py = m === 1 ? y - 1 : y
    return `${py}-${String(pm).padStart(2, '0')}`
  }, [yearMonth])

  const prevBudgets = useLiveQuery(
    () => db.accBudgets.where('yearMonth').equals(prevMonthKey).toArray(),
    [db, prevMonthKey],
  ) ?? []

  const transactions = useLiveQuery(
    () => db.accTransactions
      .where('[ledgerId+type+date]')
      .between([ledgerId, 'expense', start], [ledgerId, 'expense', end + '\uffff'])
      .toArray(),
    [db, ledgerId, start, end],
  ) ?? []

  const categories = useLiveQuery(
    () => db.accCategories.where('type').equals('expense').sortBy('sortOrder'),
    [db],
  ) ?? []

  const totalBudget = budgets.find(b => b.categoryId === null)
  const categoryBudgetMap = useMemo(() => {
    const map = new Map<number, number>()
    for (const b of budgets) {
      if (b.categoryId !== null) map.set(b.categoryId, b.amount)
    }
    return map
  }, [budgets])

  const totalExpense = useMemo(
    () => transactions.reduce((s, t) => s + t.amount, 0),
    [transactions],
  )

  const expenseByCategory = useMemo(() => {
    const map = new Map<number, number>()
    for (const t of transactions) {
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount)
    }
    return map
  }, [transactions])

  const openSettings = () => {
    setTotalBudgetInput(totalBudget?.amount?.toString() ?? '')
    const cb: Record<number, string> = {}
    for (const cat of categories) {
      const v = categoryBudgetMap.get(cat.id)
      cb[cat.id] = v ? v.toString() : ''
    }
    setCategoryBudgets(cb)
    setSettingsOpen(true)
  }

  const handleCopyFromLastMonth = () => {
    if (prevBudgets.length === 0) { message.warning('上月没有预算记录'); return }
    const prevTotal = prevBudgets.find(b => b.categoryId === null)
    if (prevTotal) setTotalBudgetInput(prevTotal.amount.toString())
    const cb: Record<number, string> = { ...categoryBudgets }
    for (const b of prevBudgets) {
      if (b.categoryId !== null) cb[b.categoryId] = b.amount.toString()
    }
    setCategoryBudgets(cb)
    message.success('已复制上月预算')
  }

  const handleSave = async () => {
    const totalVal = parseFloat(totalBudgetInput)
    const existingTotal = budgets.find(b => b.categoryId === null)
    if (totalVal > 0) {
      if (existingTotal) {
        await db.accBudgets.update(existingTotal.id, { amount: totalVal })
      } else {
        await db.accBudgets.add({ yearMonth, categoryId: null, amount: totalVal, createdAt: Date.now() })
      }
    } else if (existingTotal) {
      await db.accBudgets.delete(existingTotal.id)
    }

    for (const cat of categories) {
      const amount = parseFloat(categoryBudgets[cat.id] ?? '')
      const existing = budgets.find(b => b.categoryId === cat.id)
      if (amount > 0) {
        if (existing) await db.accBudgets.update(existing.id, { amount })
        else await db.accBudgets.add({ yearMonth, categoryId: cat.id, amount, createdAt: Date.now() })
      } else if (existing) {
        await db.accBudgets.delete(existing.id)
      }
    }

    notifyChanged()
    handleCloseSettings()
    message.success('预算已保存')
  }

  const totalPercent = totalBudget ? Math.min(100, Math.round((totalExpense / totalBudget.amount) * 100)) : 0
  const totalRemaining = totalBudget ? totalBudget.amount - totalExpense : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 16 }}>
      {/* Settings button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={openSettings} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 10, border: '1px solid #E4E4E7',
          background: '#fff', fontSize: 13, fontWeight: 600, color: '#18181B',
          cursor: 'pointer',
        }}>
          ⚙️ 设置预算
        </button>
      </div>

      {!totalBudget ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0',
          background: '#fff', borderRadius: 24, border: '1px solid #F4F4F5',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: '#FAFAFA',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 12, fontSize: 28,
          }}>
            💰
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#A1A1AA', marginBottom: 16 }}>暂未设置预算</span>
          <button onClick={openSettings} style={{
            background: '#18181B', color: '#fff', borderRadius: 12,
            padding: '10px 24px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
          }}>
            设置预算
          </button>
        </div>
      ) : (
        <>
          {/* Total budget card */}
          <div style={{
            padding: isMobile ? 16 : 20, borderRadius: 20,
            background: '#fff', border: '1px solid #F4F4F5',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#18181B' }}>月度总预算</span>
              <span style={{ fontSize: 13, color: '#A1A1AA' }}>
                ¥{formatAmount(totalBudget.amount)}
              </span>
            </div>
            <div style={{ height: 12, borderRadius: 9999, background: '#F4F4F5', overflow: 'hidden', marginBottom: 10 }}>
              <div style={{
                height: '100%', borderRadius: 9999,
                background: budgetColor(totalPercent),
                width: `${totalPercent}%`,
                transition: 'width 0.6s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#71717A' }}>
                已花 ¥{formatAmount(totalExpense)} ({totalPercent}%)
              </span>
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: totalRemaining >= 0 ? '#10B981' : '#EF4444',
              }}>
                {totalRemaining >= 0 ? `剩余 ¥${formatAmount(totalRemaining)}` : `超支 ¥${formatAmount(-totalRemaining)}`}
              </span>
            </div>
          </div>

          {/* Category budgets */}
          {categories.filter(c => categoryBudgetMap.has(c.id)).map(cat => {
            const budget = categoryBudgetMap.get(cat.id)!
            const spent = expenseByCategory.get(cat.id) ?? 0
            const percent = Math.min(100, Math.round((spent / budget) * 100))
            const remaining = budget - spent

            return (
              <div key={cat.id} style={{
                padding: isMobile ? '12px 14px' : '14px 16px',
                borderRadius: 16, background: '#fff',
                border: '1px solid #F4F4F5',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 10, background: '#F4F4F5',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                    }}>
                      {cat.emoji}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#18181B' }}>{cat.name}</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#71717A' }}>
                    ¥{formatAmount(spent)} / ¥{formatAmount(budget)}
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 9999, background: '#F4F4F5', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 9999,
                    background: budgetColor(percent),
                    width: `${percent}%`,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
                <span style={{
                  fontSize: 11, marginTop: 4, display: 'block',
                  color: remaining >= 0 ? '#A1A1AA' : '#EF4444',
                }}>
                  {remaining >= 0 ? `剩余 ¥${formatAmount(remaining)}` : `超支 ¥${formatAmount(-remaining)}`}
                </span>
              </div>
            )
          })}
        </>
      )}

      {/* Settings bottom sheet */}
      {mounted && (
        <>
          <div
            onClick={handleCloseSettings}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
              opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease',
            }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1001,
            background: '#fff', borderRadius: '24px 24px 0 0',
            maxHeight: '80vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.1)', overflow: 'hidden',
            transform: visible ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
          }}>
            {/* Drag handle */}
            <div onClick={handleCloseSettings} style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
              <div style={{ width: 40, height: 5, borderRadius: 3, background: '#E4E4E7' }} />
            </div>

            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 20px 12px', flexShrink: 0,
            }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: '#18181B' }}>设置预算</span>
              <button onClick={handleCloseSettings} style={{
                width: 32, height: 32, borderRadius: '50%', border: 'none',
                background: '#F4F4F5', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717A',
              }}>
                <CloseOutlined style={{ fontSize: 14 }} />
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 8px' }}>
              {/* Copy from last month */}
              {prevBudgets.length > 0 && (
                <button onClick={handleCopyFromLastMonth} style={{
                  width: '100%', padding: '10px 0', borderRadius: 12,
                  border: '1.5px dashed #E4E4E7', background: 'transparent',
                  fontSize: 13, fontWeight: 600, color: '#71717A', cursor: 'pointer',
                  marginBottom: 16,
                }}>
                  📋 复制上月预算
                </button>
              )}

              {/* Total budget */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#18181B', marginBottom: 8 }}>
                  月度总预算
                </label>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: '#FAFAFA', borderRadius: 14, padding: '12px 14px',
                  border: '1px solid #F4F4F5',
                }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#A1A1AA' }}>¥</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={totalBudgetInput}
                    onChange={e => setTotalBudgetInput(e.target.value)}
                    placeholder="不限"
                    style={{
                      flex: 1, border: 'none', outline: 'none', background: 'transparent',
                      fontSize: 18, fontWeight: 600, color: '#18181B',
                    }}
                  />
                </div>
              </div>

              {/* Category budgets */}
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#18181B', marginBottom: 12 }}>
                分类预算
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {categories.map(cat => (
                  <div key={cat.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: '#FAFAFA', borderRadius: 12, padding: '8px 12px',
                    border: '1px solid #F4F4F5',
                  }}>
                    <span style={{ fontSize: 18 }}>{cat.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#18181B', width: 48 }}>{cat.name}</span>
                    <div style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: 4,
                      background: '#fff', borderRadius: 10, padding: '6px 10px',
                      border: '1px solid #F4F4F5',
                    }}>
                      <span style={{ fontSize: 13, color: '#A1A1AA' }}>¥</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={categoryBudgets[cat.id] ?? ''}
                        onChange={e => setCategoryBudgets({ ...categoryBudgets, [cat.id]: e.target.value })}
                        placeholder="不限"
                        style={{
                          flex: 1, border: 'none', outline: 'none', background: 'transparent',
                          fontSize: 14, fontWeight: 500, color: '#18181B', width: 0,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Save button */}
            <div style={{ flexShrink: 0, padding: '12px 20px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
              <button onClick={handleSave} style={{
                width: '100%', height: 48, borderRadius: 14, border: 'none',
                background: '#18181B', color: '#fff', fontSize: 16, fontWeight: 700,
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(24,24,27,0.2)',
              }}>
                保存
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
