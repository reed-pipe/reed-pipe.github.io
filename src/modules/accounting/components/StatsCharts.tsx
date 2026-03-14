import { useMemo, useState } from 'react'
import { Grid } from 'antd'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDb } from '@/shared/db/context'
import type { TransactionType } from '@/shared/db'
import { formatAmount, getMonthRange } from '../utils'

const { useBreakpoint } = Grid

interface Props {
  ledgerId: number
  yearMonth: string
}

export default function StatsCharts({ ledgerId, yearMonth }: Props) {
  const db = useDb()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [txnType, setTxnType] = useState<TransactionType>('expense')

  const { start, end } = useMemo(() => getMonthRange(yearMonth), [yearMonth])

  const transactions = useLiveQuery(
    () => db.accTransactions
      .where('[ledgerId+date]')
      .between([ledgerId, start], [ledgerId, end + '\uffff'])
      .toArray(),
    [db, ledgerId, start, end],
  ) ?? []

  const categories = useLiveQuery(
    () => db.accCategories.toArray(),
    [db],
  ) ?? []

  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])

  // Category totals
  const rankData = useMemo(() => {
    const map = new Map<number, number>()
    for (const t of transactions) {
      if (t.type !== txnType) continue
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount)
    }
    const items = [...map.entries()]
      .map(([catId, amount]) => {
        const cat = catMap.get(catId)
        return { name: cat?.name ?? '未知', emoji: cat?.emoji ?? '💰', amount }
      })
      .sort((a, b) => b.amount - a.amount)

    const total = items.reduce((s, d) => s + d.amount, 0)
    const maxAmount = items.length > 0 ? items[0]!.amount : 0
    return items.map(d => ({
      ...d,
      percent: total > 0 ? (d.amount / total * 100) : 0,
      barWidth: maxAmount > 0 ? (d.amount / maxAmount * 100) : 0,
    }))
  }, [transactions, txnType, catMap])

  const totalAmount = rankData.reduce((s, d) => s + d.amount, 0)

  const isExpense = txnType === 'expense'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 16 }}>
      {/* Type toggle */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{
          display: 'flex', background: '#F4F4F5', borderRadius: 12, padding: 3,
          width: '100%', maxWidth: 240,
        }}>
          {(['expense', 'income'] as TransactionType[]).map(t => (
            <button
              key={t}
              onClick={() => setTxnType(t)}
              style={{
                flex: 1, padding: '6px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                background: txnType === t ? '#fff' : 'transparent',
                color: txnType === t ? '#18181B' : '#A1A1AA',
                boxShadow: txnType === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {t === 'expense' ? '支出' : '收入'}
            </button>
          ))}
        </div>
      </div>

      {/* Big total */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0 4px' }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#71717A', letterSpacing: '0.05em', marginBottom: 6 }}>
          总{isExpense ? '支出' : '收入'}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <span style={{ fontSize: 22, fontWeight: 500, color: '#A1A1AA' }}>¥</span>
          <span style={{ fontSize: 40, fontWeight: 700, color: '#18181B', letterSpacing: '-0.02em' }}>
            {totalAmount.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Rank card */}
      <div style={{
        background: '#fff', borderRadius: 24, padding: isMobile ? 16 : 20,
        border: '1px solid rgba(244,244,245,0.8)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0.5px 2px rgba(0,0,0,0.02)',
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#18181B', marginBottom: 20, marginTop: 0 }}>
          分类排行
        </h3>

        {rankData.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: '#FAFAFA',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 12, fontSize: 24,
            }}>
              📊
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#A1A1AA' }}>暂无数据</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {rankData.map(item => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Icon */}
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: isExpense ? '#F4F4F5' : '#ECFDF5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20,
                }}>
                  {item.emoji}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#18181B' }}>
                      {item.name}{' '}
                      <span style={{ color: '#A1A1AA', fontWeight: 500, marginLeft: 4 }}>
                        {item.percent.toFixed(1)}%
                      </span>
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#18181B' }}>
                      ¥{formatAmount(item.amount)}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div style={{
                    height: 8, borderRadius: 9999, background: '#F4F4F5', overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 9999,
                      background: isExpense ? '#18181B' : '#10B981',
                      width: `${item.barWidth}%`,
                      transition: 'width 0.6s ease-out',
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
