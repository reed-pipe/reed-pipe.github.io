import { useMemo, useState, useCallback, useRef } from 'react'
import { Grid } from 'antd'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDb } from '@/shared/db/context'
import type { TransactionType } from '@/shared/db'
import { formatAmount, getMonthRange } from '../utils'
import { useTheme } from '@/shared/hooks/useTheme'

const { useBreakpoint } = Grid

interface Props {
  ledgerId: number
  yearMonth: string
}

export default function StatsCharts({ ledgerId, yearMonth }: Props) {
  const { colors, isDark } = useTheme()
  const db = useDb()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [txnType, setTxnType] = useState<TransactionType>('expense')
  const [chartView, setChartView] = useState<'rank' | 'trend'>('rank')

  const { start, end } = useMemo(() => getMonthRange(yearMonth), [yearMonth])

  const transactions = useLiveQuery(
    () => db.accTransactions
      .where('[ledgerId+date]')
      .between([ledgerId, start], [ledgerId, end + '\uffff'])
      .filter(r => !r.deletedAt)
      .toArray(),
    [db, ledgerId, start, end],
  ) ?? []

  const categories = useLiveQuery(
    () => db.accCategories.filter(r => !r.deletedAt).toArray(),
    [db],
  ) ?? []

  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])

  // Transaction count for current type
  const txnCount = useMemo(
    () => transactions.filter(t => t.type === txnType).length,
    [transactions, txnType],
  )

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

  // Daily totals for trend chart
  const dailyData = useMemo(() => {
    const [y, m] = yearMonth.split('-').map(Number) as [number, number]
    const daysInMonth = new Date(y, m, 0).getDate()
    const map = new Map<number, number>()
    for (const t of transactions) {
      if (t.type !== txnType) continue
      const day = parseInt(t.date.slice(8), 10)
      map.set(day, (map.get(day) ?? 0) + t.amount)
    }
    const result: { day: number; amount: number }[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ day: d, amount: map.get(d) ?? 0 })
    }
    return result
  }, [transactions, txnType, yearMonth])

  const totalAmount = rankData.reduce((s, d) => s + d.amount, 0)

  const isExpense = txnType === 'expense'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 16 }}>
      {/* Type toggle */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{
          display: 'flex', background: colors.borderLight, borderRadius: 12, padding: 3,
          width: '100%', maxWidth: 240,
        }}>
          {(['expense', 'income'] as TransactionType[]).map(t => (
            <button
              key={t}
              onClick={() => setTxnType(t)}
              style={{
                flex: 1, padding: '6px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                background: txnType === t ? colors.bgElevated : 'transparent',
                color: txnType === t ? colors.text : colors.textTertiary,
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
        <div style={{ fontSize: 12, fontWeight: 500, color: colors.textSecondary, letterSpacing: '0.05em', marginBottom: 6 }}>
          总{isExpense ? '支出' : '收入'}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <span style={{ fontSize: 22, fontWeight: 500, color: colors.textTertiary }}>¥</span>
          <span style={{ fontSize: 40, fontWeight: 700, color: colors.text, letterSpacing: '-0.02em' }}>
            {totalAmount.toFixed(2)}
          </span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 500, color: colors.textTertiary, marginTop: 2 }}>
          共 {txnCount} 笔
        </div>
      </div>

      {/* Chart view toggle: 排行 | 趋势 */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{
          display: 'flex', background: colors.borderLight, borderRadius: 12, padding: 3,
          width: '100%', maxWidth: 180,
        }}>
          {([{ key: 'rank' as const, label: '排行' }, { key: 'trend' as const, label: '趋势' }]).map(v => (
            <button
              key={v.key}
              onClick={() => setChartView(v.key)}
              style={{
                flex: 1, padding: '5px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                background: chartView === v.key ? colors.bgElevated : 'transparent',
                color: chartView === v.key ? colors.text : colors.textTertiary,
                boxShadow: chartView === v.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {chartView === 'rank' ? (
        /* Rank card */
        <div style={{
          background: colors.bgElevated, borderRadius: 24, padding: isMobile ? 16 : 20,
          border: `1px solid ${colors.borderLight}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0.5px 2px rgba(0,0,0,0.02)',
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: colors.text, marginBottom: 20, marginTop: 0 }}>
            分类排行
          </h3>

          {rankData.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: colors.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 12, fontSize: 24,
              }}>
                📊
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: colors.textTertiary }}>暂无数据</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {rankData.map(item => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Icon */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: isExpense ? colors.borderLight : colors.successBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20,
                  }}>
                    {item.emoji}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>
                        {item.name}{' '}
                        <span style={{ color: colors.textTertiary, fontWeight: 500, marginLeft: 4 }}>
                          {item.percent.toFixed(1)}%
                        </span>
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>
                        ¥{formatAmount(item.amount)}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div style={{
                      height: 8, borderRadius: 9999, background: colors.borderLight, overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 9999,
                        background: isExpense ? (isDark ? '#242424' : '#18181B') : '#10B981',
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
      ) : (
        /* Trend chart */
        <TrendChart dailyData={dailyData} isExpense={isExpense} isMobile={isMobile} />
      )}
    </div>
  )
}

function TrendChart({ dailyData, isExpense, isMobile }: {
  dailyData: { day: number; amount: number }[]
  isExpense: boolean
  isMobile: boolean
}) {
  const { colors, isDark } = useTheme()
  const [containerWidth, setContainerWidth] = useState(300)
  const [tooltip, setTooltip] = useState<{ day: number; amount: number; x: number; y: number } | null>(null)
  const roRef = useRef<ResizeObserver | null>(null)

  const measuredRef = useCallback((node: HTMLDivElement | null) => {
    if (roRef.current) { roRef.current.disconnect(); roRef.current = null }
    if (node) {
      const w = node.getBoundingClientRect().width
      if (w > 0) setContainerWidth(w)
      const ro = new ResizeObserver(entries => {
        const e = entries[0]
        if (e && e.contentRect.width > 0) setContainerWidth(e.contentRect.width)
      })
      ro.observe(node)
      roRef.current = ro
    }
  }, [])

  const CHART_H = 180
  const PADDING_TOP = 28
  const PADDING_BOTTOM = 24
  const PADDING_LEFT = 8
  const PADDING_RIGHT = 8
  const chartWidth = containerWidth - PADDING_LEFT - PADDING_RIGHT
  const chartHeight = CHART_H - PADDING_TOP - PADDING_BOTTOM
  const barColor = isExpense ? (isDark ? '#242424' : '#18181B') : '#10B981'

  const maxAmount = useMemo(() => Math.max(...dailyData.map(d => d.amount), 1), [dailyData])
  const barGap = 2
  const barWidth = Math.max(8, (chartWidth - (dailyData.length - 1) * barGap) / dailyData.length)
  const totalBarsWidth = dailyData.length * barWidth + (dailyData.length - 1) * barGap
  const offsetX = PADDING_LEFT + (chartWidth - totalBarsWidth) / 2

  const xLabels = [1, 5, 10, 15, 20, 25]
  const lastDay = dailyData.length
  if (lastDay >= 28) xLabels.push(lastDay)

  return (
    <div
      ref={measuredRef}
      style={{
        background: colors.bgElevated, borderRadius: 24, padding: isMobile ? 16 : 20,
        border: `1px solid ${colors.borderLight}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0.5px 2px rgba(0,0,0,0.02)',
        position: 'relative',
      }}
    >
      <h3 style={{ fontSize: 14, fontWeight: 700, color: colors.text, marginBottom: 12, marginTop: 0 }}>
        每日趋势
      </h3>

      <svg width={containerWidth - (isMobile ? 32 : 40)} height={CHART_H} style={{ display: 'block' }}>
        {/* Max value label */}
        <text x={PADDING_LEFT} y={PADDING_TOP - 8} fontSize={10} fill={colors.textTertiary}>
          ¥{formatAmount(maxAmount)}
        </text>

        {/* Bars */}
        {dailyData.map((d, i) => {
          const barH = d.amount > 0 ? Math.max(2, (d.amount / maxAmount) * chartHeight) : 0
          const x = offsetX + i * (barWidth + barGap)
          const y = PADDING_TOP + chartHeight - barH
          return (
            <rect
              key={d.day}
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              rx={Math.min(3, barWidth / 2)}
              fill={barColor}
              opacity={d.amount > 0 ? 0.85 : 0.1}
              style={{ cursor: d.amount > 0 ? 'pointer' : 'default', transition: 'opacity 0.15s' }}
              onMouseEnter={() => {
                if (d.amount > 0) setTooltip({ day: d.day, amount: d.amount, x: x + barWidth / 2, y: y - 6 })
              }}
              onMouseLeave={() => setTooltip(null)}
              onClick={() => {
                if (d.amount > 0) setTooltip(prev =>
                  prev?.day === d.day ? null : { day: d.day, amount: d.amount, x: x + barWidth / 2, y: y - 6 }
                )
              }}
            />
          )
        })}

        {/* X-axis labels */}
        {xLabels.map(day => {
          const i = day - 1
          if (i >= dailyData.length) return null
          const x = offsetX + i * (barWidth + barGap) + barWidth / 2
          return (
            <text
              key={day}
              x={x}
              y={PADDING_TOP + chartHeight + 16}
              textAnchor="middle"
              fontSize={10}
              fill={colors.textTertiary}
            >
              {day}
            </text>
          )
        })}

        {/* Tooltip */}
        {tooltip && (
          <g>
            <rect
              x={Math.max(4, Math.min(tooltip.x - 40, (containerWidth - (isMobile ? 32 : 40)) - 84))}
              y={Math.max(0, tooltip.y - 28)}
              width={80}
              height={24}
              rx={6}
              fill={isDark ? '#333' : '#18181B'}
            />
            <text
              x={Math.max(44, Math.min(tooltip.x, (containerWidth - (isMobile ? 32 : 40)) - 44))}
              y={Math.max(16, tooltip.y - 12)}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill="#fff"
            >
              {tooltip.day}日 ¥{formatAmount(tooltip.amount)}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}
