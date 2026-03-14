import { useMemo } from 'react'
import { Grid } from 'antd'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDb } from '@/shared/db/context'
import { formatAmount, getMonthRange } from '../utils'
import { colors } from '@/shared/theme'

const { useBreakpoint } = Grid

interface Props {
  ledgerId: number
  yearMonth: string
  /** When true, only show the 环比 comparison (used in index.tsx desktop mode) */
  compactMode?: boolean
}

export default function MonthlySummary({ ledgerId, yearMonth, compactMode }: Props) {
  const db = useDb()
  const screens = useBreakpoint()
  const isMobile = !screens.md
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

  // compactMode: only show 环比 info (for desktop header)
  if (compactMode) {
    if (changePercent === null) return null
    return (
      <div style={{ fontSize: 12, color: colors.textTertiary }}>
        较上月支出
        <span style={{
          color: changePercent > 0 ? colors.danger : colors.success,
          fontWeight: 600,
          marginLeft: 4,
        }}>
          {changePercent >= 0 ? '+' : ''}{changePercent}%
        </span>
      </div>
    )
  }

  // Full display (standalone usage)
  return (
    <div style={{
      display: 'flex',
      gap: isMobile ? 16 : 32,
      padding: isMobile ? '10px 4px' : '12px 8px',
    }}>
      <div>
        <div style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 2 }}>支出</div>
        <div style={{
          fontSize: isMobile ? 20 : 24, fontWeight: 800, color: colors.danger,
          lineHeight: 1.1, letterSpacing: '-0.02em',
        }}>
          {formatAmount(expense)}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 2 }}>收入</div>
        <div style={{
          fontSize: isMobile ? 20 : 24, fontWeight: 800, color: colors.success,
          lineHeight: 1.1, letterSpacing: '-0.02em',
        }}>
          {formatAmount(income)}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 2 }}>结余</div>
        <div style={{
          fontSize: isMobile ? 20 : 24, fontWeight: 800,
          color: balance > 0 ? colors.success : balance < 0 ? colors.danger : colors.textSecondary,
          lineHeight: 1.1, letterSpacing: '-0.02em',
        }}>
          {balance === 0 ? '0' : (balance > 0 ? '+' : '-') + formatAmount(Math.abs(balance))}
        </div>
      </div>
      {changePercent !== null && !isMobile && (
        <div>
          <div style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 2 }}>环比</div>
          <div style={{
            fontSize: isMobile ? 20 : 24, fontWeight: 800,
            color: changePercent > 0 ? colors.danger : colors.success,
            lineHeight: 1.1, letterSpacing: '-0.02em',
          }}>
            {changePercent >= 0 ? '+' : ''}{changePercent}%
          </div>
        </div>
      )}
    </div>
  )
}
