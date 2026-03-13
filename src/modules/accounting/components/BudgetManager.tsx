import { useState, useMemo } from 'react'
import { Typography, Empty, Progress, Modal, InputNumber, Button, message, Grid } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDb } from '@/shared/db/context'
import { useDataChanged } from '@/shared/sync/useDataChanged'
import { getMonthRange, formatAmount } from '../utils'
import { colors, shadows } from '@/shared/theme'

const { Text } = Typography

interface Props {
  ledgerId: number
  yearMonth: string
}

function budgetColor(percent: number): string {
  if (percent >= 90) return colors.danger
  if (percent >= 70) return colors.warning
  return colors.success
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
    <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Settings button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button icon={<SettingOutlined />} onClick={openSettings} size="small">
          设置预算
        </Button>
      </div>

      {!totalBudget ? (
        <Empty description="暂未设置预算" style={{ padding: 40 }}>
          <Button type="primary" onClick={openSettings}>设置预算</Button>
        </Empty>
      ) : (
        <>
          {/* Total budget card */}
          <div style={{
            padding: 20, borderRadius: 18,
            background: '#fff',
            border: `1px solid ${colors.borderLight}`,
            boxShadow: shadows.card,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text strong style={{ fontSize: 15 }}>月度总预算</Text>
              <Text style={{ fontSize: 13, color: colors.textTertiary }}>
                {formatAmount(totalBudget.amount)}
              </Text>
            </div>
            <Progress
              percent={totalPercent}
              strokeColor={budgetColor(totalPercent)}
              size={{ height: 16 }}
              format={() => `${totalPercent}%`}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              <Text style={{ fontSize: 13, color: colors.danger }}>
                已花 {formatAmount(totalExpense)}
              </Text>
              <Text style={{
                fontSize: 13,
                color: totalRemaining >= 0 ? colors.success : colors.danger,
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
                padding: '14px 16px', borderRadius: 14,
                background: '#fff',
                border: `1px solid ${colors.borderLight}`,
                boxShadow: shadows.card,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{cat.emoji}</span>
                    <Text style={{ fontSize: 13, fontWeight: 500 }}>{cat.name}</Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatAmount(spent)} / {formatAmount(budget)}
                  </Text>
                </div>
                <Progress
                  percent={percent}
                  strokeColor={budgetColor(percent)}
                  size={{ height: 10 }}
                  showInfo={false}
                />
                <Text style={{
                  fontSize: 11, marginTop: 4, display: 'block',
                  color: remaining >= 0 ? colors.textTertiary : colors.danger,
                }}>
                  {remaining >= 0 ? `剩余 ${formatAmount(remaining)}` : `超支 ${formatAmount(-remaining)}`}
                </Text>
              </div>
            )
          })}
        </>
      )}

      {/* Settings modal */}
      <Modal
        title="设置预算"
        open={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        onOk={handleSave}
        okText="保存"
        width={isMobile ? '92vw' : 440}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
            {categories.map(cat => (
              <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16, width: 24 }}>{cat.emoji}</span>
                <Text style={{ fontSize: 13, width: 60 }}>{cat.name}</Text>
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
        </div>
      </Modal>
    </div>
  )
}
