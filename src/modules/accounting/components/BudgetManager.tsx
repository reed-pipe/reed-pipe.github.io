import { useState, useMemo } from 'react'
import { Typography, Modal, Drawer, InputNumber, Button, message, Grid } from 'antd'
import { SettingOutlined, CopyOutlined } from '@ant-design/icons'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDb } from '@/shared/db/context'
import { useDataChanged } from '@/shared/sync/useDataChanged'
import { getMonthRange, formatAmount } from '../utils'

const { Text } = Typography

interface Props {
  ledgerId: number
  yearMonth: string
}

function budgetColor(percent: number): string {
  if (percent >= 90) return '#EF4444'
  if (percent >= 70) return '#F59E0B'
  return '#18181B'
}

const { useBreakpoint } = Grid

export default function BudgetManager({ ledgerId, yearMonth }: Props) {
  const db = useDb()
  const notifyChanged = useDataChanged()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [totalBudgetInput, setTotalBudgetInput] = useState<number | null>(null)
  const [categoryBudgets, setCategoryBudgets] = useState<Record<number, number | null>>({})

  const { start, end } = useMemo(() => getMonthRange(yearMonth), [yearMonth])

  const budgets = useLiveQuery(
    () => db.accBudgets.where('yearMonth').equals(yearMonth).toArray(),
    [db, yearMonth],
  ) ?? []

  // Previous month budgets for "copy from last month"
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
    setTotalBudgetInput(totalBudget?.amount ?? null)
    const cb: Record<number, number | null> = {}
    for (const cat of categories) {
      cb[cat.id] = categoryBudgetMap.get(cat.id) ?? null
    }
    setCategoryBudgets(cb)
    setSettingsOpen(true)
  }

  const handleCopyFromLastMonth = () => {
    if (prevBudgets.length === 0) {
      message.warning('上月没有预算记录')
      return
    }
    const prevTotal = prevBudgets.find(b => b.categoryId === null)
    if (prevTotal) setTotalBudgetInput(prevTotal.amount)
    const cb: Record<number, number | null> = { ...categoryBudgets }
    for (const b of prevBudgets) {
      if (b.categoryId !== null) cb[b.categoryId] = b.amount
    }
    setCategoryBudgets(cb)
    message.success('已复制上月预算')
  }

  const handleSave = async () => {
    // Save total budget
    const existingTotal = budgets.find(b => b.categoryId === null)
    if (totalBudgetInput && totalBudgetInput > 0) {
      if (existingTotal) {
        await db.accBudgets.update(existingTotal.id, { amount: totalBudgetInput })
      } else {
        await db.accBudgets.add({
          yearMonth,
          categoryId: null,
          amount: totalBudgetInput,
          createdAt: Date.now(),
        })
      }
    } else if (existingTotal) {
      await db.accBudgets.delete(existingTotal.id)
    }

    // Save category budgets
    for (const cat of categories) {
      const amount = categoryBudgets[cat.id]
      const existing = budgets.find(b => b.categoryId === cat.id)
      if (amount && amount > 0) {
        if (existing) {
          await db.accBudgets.update(existing.id, { amount })
        } else {
          await db.accBudgets.add({
            yearMonth,
            categoryId: cat.id,
            amount,
            createdAt: Date.now(),
          })
        }
      } else if (existing) {
        await db.accBudgets.delete(existing.id)
      }
    }

    notifyChanged()
    setSettingsOpen(false)
    message.success('预算已保存')
  }

  const totalPercent = totalBudget ? Math.min(100, Math.round((totalExpense / totalBudget.amount) * 100)) : 0
  const totalRemaining = totalBudget ? totalBudget.amount - totalExpense : 0

  return (
    <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 16 }}>
      {/* Settings button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button icon={<SettingOutlined />} onClick={openSettings} size="small">
          设置预算
        </Button>
      </div>

      {!totalBudget ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0',
          background: '#fff', borderRadius: 16, border: '1px solid #F4F4F5',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: '#FAFAFA',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 12, fontSize: 24,
          }}>
            💰
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#A1A1AA', marginBottom: 16 }}>暂未设置预算</span>
          <Button type="primary" onClick={openSettings}>设置预算</Button>
        </div>
      ) : (
        <>
          {/* Total budget card */}
          <div style={{
            padding: isMobile ? 14 : 20, borderRadius: 16,
            background: '#fff',
            border: '1px solid #F4F4F5',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text strong style={{ fontSize: isMobile ? 14 : 15, color: '#18181B' }}>月度总预算</Text>
              <Text style={{ fontSize: 13, color: '#A1A1AA' }}>
                {formatAmount(totalBudget.amount)}
              </Text>
            </div>
            <div style={{ height: isMobile ? 12 : 16, borderRadius: 9999, background: '#F4F4F5', overflow: 'hidden', marginBottom: 8 }}>
              <div style={{
                height: '100%', borderRadius: 9999,
                background: budgetColor(totalPercent),
                width: `${totalPercent}%`,
                transition: 'width 0.6s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: '#18181B' }}>
                已花 {formatAmount(totalExpense)} ({totalPercent}%)
              </Text>
              <Text style={{
                fontSize: 12,
                color: totalRemaining >= 0 ? '#10B981' : '#EF4444',
                fontWeight: 600,
              }}>
                {totalRemaining >= 0 ? `剩余 ${formatAmount(totalRemaining)}` : `超支 ${formatAmount(-totalRemaining)}`}
              </Text>
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
                padding: isMobile ? '10px 12px' : '14px 16px',
                borderRadius: 16,
                background: '#fff',
                border: '1px solid #F4F4F5',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: isMobile ? 16 : 18 }}>{cat.emoji}</span>
                    <Text style={{ fontSize: 13, fontWeight: 500, color: '#18181B' }}>{cat.name}</Text>
                  </div>
                  <Text style={{ fontSize: 11, color: '#71717A' }}>
                    {formatAmount(spent)} / {formatAmount(budget)}
                  </Text>
                </div>
                <div style={{ height: isMobile ? 8 : 10, borderRadius: 9999, background: '#F4F4F5', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 9999,
                    background: budgetColor(percent),
                    width: `${percent}%`,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
                <Text style={{
                  fontSize: 11, marginTop: 3, display: 'block',
                  color: remaining >= 0 ? '#A1A1AA' : '#EF4444',
                }}>
                  {remaining >= 0 ? `剩余 ${formatAmount(remaining)}` : `超支 ${formatAmount(-remaining)}`}
                </Text>
              </div>
            )
          })}
        </>
      )}

      {/* Settings modal / drawer */}
      {(() => {
        const settingsContent = (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Copy from last month */}
            {prevBudgets.length > 0 && (
              <Button
                type="dashed"
                icon={<CopyOutlined />}
                block
                onClick={handleCopyFromLastMonth}
                size="small"
              >
                复制上月预算
              </Button>
            )}

            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>月度总预算</Text>
              <InputNumber
                value={totalBudgetInput}
                onChange={v => setTotalBudgetInput(v)}
                min={0}
                step={100}
                placeholder="不限"
                style={{ width: '100%' }}
                prefix="¥"
              />
            </div>

            <Text strong>分类预算（可选）</Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: isMobile ? undefined : 280, overflowY: isMobile ? undefined : 'auto' }}>
              {categories.map(cat => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16, width: 22 }}>{cat.emoji}</span>
                  <Text style={{ fontSize: 13, width: 50 }}>{cat.name}</Text>
                  <InputNumber
                    value={categoryBudgets[cat.id]}
                    onChange={v => setCategoryBudgets({ ...categoryBudgets, [cat.id]: v })}
                    min={0}
                    step={100}
                    placeholder="不限"
                    style={{ flex: 1 }}
                    size="small"
                    prefix="¥"
                  />
                </div>
              ))}
            </div>

            {isMobile && (
              <Button type="primary" block onClick={handleSave} style={{ marginTop: 8 }}>
                保存
              </Button>
            )}
          </div>
        )

        return isMobile ? (
          <Drawer
            title="设置预算"
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            placement="bottom"
            height="70vh"
          >
            {settingsContent}
          </Drawer>
        ) : (
          <Modal
            title="设置预算"
            open={settingsOpen}
            onCancel={() => setSettingsOpen(false)}
            onOk={handleSave}
            okText="保存"
            width={440}
          >
            {settingsContent}
          </Modal>
        )
      })()}
    </div>
  )
}
