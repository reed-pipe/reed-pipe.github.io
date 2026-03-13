import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDb } from '@/shared/db/context'
import { formatAmount, getMonthRange } from '../utils'
import { colors, shadows } from '@/shared/theme'

interface Props {
  ledgerId: number
  yearMonth: string
}

function StatCard({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 14,
      background: '#fff',
      border: `1px solid ${colors.borderLight}`,
      boxShadow: shadows.card,
      minWidth: 0,
    }}>
      <div style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 4 }}>{title}</div>
      <div style={{
        fontSize: 22, fontWeight: 800, color, lineHeight: 1.1, letterSpacing: '-0.02em',
      }}>
        {value}
      </div>
    </div>
  )
}

export default function MonthlySummary({ ledgerId, yearMonth }: Props) {
  const db = useDb()
  const { start, end } = useMemo(() => getMonthRange(yearMonth), [yearMonth])

  const transactions = useLiveQuery(
    () => db.accTransactions
      .where('[ledgerId+date]')
      .between([ledgerId, start], [ledgerId, end + '\uffff'])
      .toArray(),
    [db, ledgerId, start, end],
  ) ?? []

  const { income, expense } = useMemo(() => {
    let income = 0, expense = 0
    for (const t of transactions) {
      if (t.type === 'income') income += t.amount
      else expense += t.amount
    }
    return { income, expense }
  }, [transactions])

  const balance = income - expense

  // Get previous month for comparison
  const prevMonth = useMemo(() => {
    const [y, m] = yearMonth.split('-').map(Number) as [number, number]
    const pm = m === 1 ? 12 : m - 1
    const py = m === 1 ? y - 1 : y
    return `${py}-${String(pm).padStart(2, '0')}`
  }, [yearMonth])

  const prevRange = useMemo(() => getMonthRange(prevMonth), [prevMonth])

  const prevTransactions = useLiveQuery(
    () => db.accTransactions
      .where('[ledgerId+date]')
      .between([ledgerId, prevRange.start], [ledgerId, prevRange.end + '\uffff'])
      .toArray(),
    [db, ledgerId, prevRange.start, prevRange.end],
  ) ?? []

  const prevExpense = useMemo(
    () => prevTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    [prevTransactions],
  )

  const changePercent = prevExpense > 0
    ? Math.round(((expense - prevExpense) / prevExpense) * 100)
    : null

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
      gap: 8,
      marginBottom: 8,
    }}>
      <StatCard title="支出" value={formatAmount(expense)} color={colors.danger} />
      <StatCard title="收入" value={formatAmount(income)} color={colors.success} />
      <StatCard
        title="结余"
        value={balance === 0 ? '0' : (balance > 0 ? '+' : '-') + formatAmount(Math.abs(balance))}
        color={balance > 0 ? colors.success : balance < 0 ? colors.danger : colors.textSecondary}
      />
      {changePercent !== null && (
        <StatCard
          title="环比支出"
          value={`${changePercent >= 0 ? '+' : ''}${changePercent}%`}
          color={changePercent > 0 ? colors.danger : colors.success}
        />
      )}
    </div>
  )
}
