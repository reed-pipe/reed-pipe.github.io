import { useMemo, useState, useCallback, useRef } from 'react'
import { Segmented, Empty, DatePicker, Typography } from 'antd'
import dayjs from 'dayjs'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDb } from '@/shared/db/context'
import type { TransactionType } from '@/shared/db'
import { formatAmount, getMonthRange } from '../utils'
import { colors } from '@/shared/theme'

const { RangePicker } = DatePicker
const { Text } = Typography

interface Props {
  ledgerId: number
  yearMonth: string
}

type ChartTab = 'pie' | 'trend' | 'rank'
type DateRange = 'week' | 'month' | 'year' | 'custom'
type TrendGranularity = 'day' | 'week' | 'month'

function getDateRange(range: DateRange, yearMonth: string, customRange: [string, string] | null): { start: string; end: string } {
  if (range === 'custom' && customRange) {
    return { start: customRange[0], end: customRange[1] }
  }
  if (range === 'week') {
    const now = dayjs()
    return { start: now.startOf('week').format('YYYY-MM-DD'), end: now.endOf('week').format('YYYY-MM-DD') }
  }
  if (range === 'year') {
    const y = yearMonth.split('-')[0]
    return { start: `${y}-01-01`, end: `${y}-12-31` }
  }
  return getMonthRange(yearMonth)
}

// --- Donut chart (reused from CostChart pattern) ---

function DonutChart({ data, size = 160 }: { data: { color: string; amount: number; name: string; emoji: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.amount, 0)
  if (total === 0) return null

  const r = (size - 20) / 2
  const cx = size / 2
  const cy = size / 2
  const strokeWidth = 24

  let startAngle = -90
  const segments = data.map(d => {
    const angle = (d.amount / total) * 360
    const seg = { ...d, startAngle, angle }
    startAngle += angle
    return seg
  })

  function arcPath(start: number, angle: number) {
    // Clamp to avoid full-circle arc (SVG arc can't draw 360°)
    const clampedAngle = Math.min(angle, 359.9)
    const s = (start * Math.PI) / 180
    const e = ((start + clampedAngle) * Math.PI) / 180
    const large = clampedAngle > 180 ? 1 : 0
    return `M ${cx + r * Math.cos(s)} ${cy + r * Math.sin(s)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(e)} ${cy + r * Math.sin(e)}`
  }

  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={strokeWidth} />
      {segments.map((seg, i) => (
        <path
          key={i}
          d={arcPath(seg.startAngle, Math.max(seg.angle - 1.5, 0.5))}
          fill="none"
          stroke={seg.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      ))}
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize={12} fill={colors.textTertiary}>总计</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={20} fontWeight={800} fill={colors.text}>
        {formatAmount(total)}
      </text>
    </svg>
  )
}

// --- Trend line chart ---

const TREND_PADDING = { top: 24, right: 40, bottom: 32, left: 50 }
const TREND_HEIGHT = 220

function niceYTicks(min: number, max: number, count = 5): number[] {
  const rawStep = (max - min) / count
  if (rawStep <= 0) return [min]
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const res = rawStep / mag
  let step: number
  if (res <= 1) step = 1 * mag
  else if (res <= 2) step = 2 * mag
  else if (res <= 5) step = 5 * mag
  else step = 10 * mag
  if (step < 1) step = 1
  const nMin = Math.floor(min / step) * step
  const nMax = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = nMin; v <= nMax + step * 0.01; v += step) ticks.push(Math.round(v))
  return ticks
}

function TrendChart({ data, type }: { data: { label: string; expense: number; income: number }[]; type: TransactionType }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const roRef = useRef<ResizeObserver | null>(null)
  const [width, setWidth] = useState(400)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  const measuredRef = useCallback((node: HTMLDivElement | null) => {
    if (roRef.current) { roRef.current.disconnect(); roRef.current = null }
    if (node) {
      const w = node.getBoundingClientRect().width
      if (w > 0) setWidth(w)
      const ro = new ResizeObserver(entries => {
        const e = entries[0]
        if (e) setWidth(e.contentRect.width)
      })
      ro.observe(node)
      roRef.current = ro
    }
  }, [])

  const values = data.map(d => type === 'expense' ? d.expense : d.income)
  if (values.length === 0 || values.every(v => v === 0)) {
    return <Empty description="暂无数据" style={{ padding: 32 }} />
  }

  const maxVal = Math.max(...values, 1)
  const yTicks = niceYTicks(0, maxVal)
  const yMax = yTicks[yTicks.length - 1]!

  const plotW = width - TREND_PADDING.left - TREND_PADDING.right
  const plotH = TREND_HEIGHT - TREND_PADDING.top - TREND_PADDING.bottom
  const n = data.length

  const toX = (i: number) => TREND_PADDING.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const toY = (v: number) => TREND_PADDING.top + plotH - (v / yMax) * plotH

  const lineColor = type === 'expense' ? colors.danger : colors.success
  const points = values.map((v, i) => `${toX(i)},${toY(v)}`).join(' ')
  const areaPath = `M${toX(0)},${toY(values[0]!)} ` +
    values.slice(1).map((v, i) => `L${toX(i + 1)},${toY(v)}`).join(' ') +
    ` L${toX(n - 1)},${TREND_PADDING.top + plotH} L${toX(0)},${TREND_PADDING.top + plotH} Z`

  const handleInteraction = (clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left
    let closest = 0, minDist = Infinity
    for (let i = 0; i < n; i++) {
      const dist = Math.abs(toX(i) - x)
      if (dist < minDist) { minDist = dist; closest = i }
    }
    setActiveIdx(closest)
  }

  const maxLabels = Math.max(2, Math.floor(plotW / 48))
  const labelInterval = Math.max(1, Math.ceil(n / maxLabels))

  return (
    <div ref={(node) => { containerRef.current = node; measuredRef(node) }}>
      <svg
        width={width} height={TREND_HEIGHT}
        style={{ display: 'block', touchAction: 'none' }}
        onMouseMove={e => handleInteraction(e.clientX)}
        onMouseLeave={() => setActiveIdx(null)}
        onTouchMove={e => { const t = e.touches[0]; if (t) handleInteraction(t.clientX) }}
        onTouchEnd={() => setTimeout(() => setActiveIdx(null), 1500)}
      >
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Y axis */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={TREND_PADDING.left} y1={toY(v)} x2={width - TREND_PADDING.right} y2={toY(v)} stroke="#E5E7EB" strokeDasharray="4 2" />
            <text x={TREND_PADDING.left - 8} y={toY(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill={colors.textTertiary}>
              {formatAmount(v)}
            </text>
          </g>
        ))}

        {/* X labels */}
        {data.map((d, i) => {
          if (i % labelInterval !== 0 && i !== n - 1) return null
          return <text key={i} x={toX(i)} y={TREND_HEIGHT - 8} textAnchor="middle" fontSize={10} fill={colors.textTertiary}>{d.label}</text>
        })}

        {/* Area + line */}
        {n > 1 && <path d={areaPath} fill="url(#trendGrad)" />}
        {n > 1 && <polyline fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" points={points} />}

        {/* Points */}
        {values.map((v, i) => (
          <circle key={i} cx={toX(i)} cy={toY(v)} r={activeIdx === i ? 6 : 3.5}
            fill={activeIdx === i ? lineColor : lineColor} stroke="#fff" strokeWidth={activeIdx === i ? 2 : 1.5} />
        ))}

        {/* Active line */}
        {activeIdx !== null && (
          <line x1={toX(activeIdx)} y1={TREND_PADDING.top} x2={toX(activeIdx)} y2={TREND_PADDING.top + plotH}
            stroke={colors.textTertiary} strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />
        )}
      </svg>

      {activeIdx !== null && data[activeIdx] && (
        <div style={{ padding: '4px 12px', fontSize: 12, color: colors.textSecondary, textAlign: 'center', borderTop: `1px solid ${colors.borderLight}` }}>
          <strong>{data[activeIdx]!.label}</strong>:
          <span style={{ color: colors.danger, marginLeft: 8 }}>支出 {formatAmount(data[activeIdx]!.expense)}</span>
          <span style={{ color: colors.success, marginLeft: 8 }}>收入 {formatAmount(data[activeIdx]!.income)}</span>
        </div>
      )}
    </div>
  )
}

export default function StatsCharts({ ledgerId, yearMonth }: Props) {
  const db = useDb()
  const [chartTab, setChartTab] = useState<ChartTab>('pie')
  const [txnType, setTxnType] = useState<TransactionType>('expense')
  const [dateRange, setDateRange] = useState<DateRange>('month')
  const [customRange, setCustomRange] = useState<[string, string] | null>(null)
  const [trendGranularity, setTrendGranularity] = useState<TrendGranularity>('day')

  const { start, end } = useMemo(
    () => getDateRange(dateRange, yearMonth, customRange),
    [dateRange, yearMonth, customRange],
  )

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

  // --- Pie data ---
  const pieData = useMemo(() => {
    const map = new Map<number, number>()
    for (const t of transactions) {
      if (t.type !== txnType) continue
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount)
    }
    return [...map.entries()]
      .map(([catId, amount]) => {
        const cat = catMap.get(catId)
        return { name: cat?.name ?? '未知', emoji: cat?.emoji ?? '💰', color: cat?.color ?? '#6B7280', amount }
      })
      .sort((a, b) => b.amount - a.amount)
  }, [transactions, txnType, catMap])

  // --- Trend data ---
  const trendData = useMemo(() => {
    const buckets = new Map<string, { expense: number; income: number }>()

    for (const t of transactions) {
      let key: string
      if (trendGranularity === 'day') {
        key = t.date.slice(5) // MM-DD
      } else if (trendGranularity === 'week') {
        const d = new Date(t.date + 'T00:00:00')
        const startOfYear = new Date(d.getFullYear(), 0, 1)
        const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86_400_000 + startOfYear.getDay() + 1) / 7)
        key = `W${weekNum}`
      } else {
        key = t.date.slice(0, 7) // YYYY-MM
      }
      const entry = buckets.get(key) ?? { expense: 0, income: 0 }
      if (t.type === 'expense') entry.expense += t.amount
      else entry.income += t.amount
      buckets.set(key, entry)
    }

    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, vals]) => ({ label, ...vals }))
  }, [transactions, trendGranularity])

  // --- Rank data ---
  const rankData = useMemo(() => {
    const total = pieData.reduce((s, d) => s + d.amount, 0)
    const max = pieData.length > 0 ? pieData[0]!.amount : 0
    return pieData.map(d => ({ ...d, percent: total > 0 ? Math.round(d.amount / total * 100) : 0, ratio: max > 0 ? d.amount / max : 0 }))
  }, [pieData])

  const totalAmount = pieData.reduce((s, d) => s + d.amount, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Date range selector */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Segmented
          size="small"
          value={dateRange}
          onChange={v => setDateRange(v as DateRange)}
          options={[
            { label: '周', value: 'week' },
            { label: '月', value: 'month' },
            { label: '年', value: 'year' },
            { label: '自定义', value: 'custom' },
          ]}
        />
        {dateRange === 'custom' && (
          <RangePicker
            size="small"
            onChange={(dates) => {
              if (dates?.[0] && dates?.[1]) {
                setCustomRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')])
              }
            }}
          />
        )}
      </div>

      {/* Chart tab */}
      <Segmented
        block
        value={chartTab}
        onChange={v => setChartTab(v as ChartTab)}
        options={[
          { label: '分类饼图', value: 'pie' },
          { label: '趋势折线', value: 'trend' },
          { label: '分类排行', value: 'rank' },
        ]}
      />

      {/* Type toggle for all chart types */}
      <Segmented
        size="small"
        value={txnType}
        onChange={v => setTxnType(v as TransactionType)}
        options={[
          { label: '支出', value: 'expense' },
          { label: '收入', value: 'income' },
        ]}
      />

      {/* Pie chart */}
      {chartTab === 'pie' && (
        pieData.length === 0 ? (
          <Empty description="暂无数据" style={{ padding: 40 }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <DonutChart data={pieData} />
            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
              {pieData.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                  <span>{d.emoji} {d.name}</span>
                  <span style={{ color: colors.textTertiary }}>
                    {formatAmount(d.amount)} ({totalAmount > 0 ? Math.round(d.amount / totalAmount * 100) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Trend chart */}
      {chartTab === 'trend' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <Segmented
              size="small"
              value={trendGranularity}
              onChange={v => setTrendGranularity(v as TrendGranularity)}
              options={[
                { label: '日', value: 'day' },
                { label: '周', value: 'week' },
                { label: '月', value: 'month' },
              ]}
            />
          </div>
          <TrendChart data={trendData} type={txnType} />
        </div>
      )}

      {/* Rank chart */}
      {chartTab === 'rank' && (
        rankData.length === 0 ? (
          <Empty description="暂无数据" style={{ padding: 40 }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rankData.map(cat => (
              <div key={cat.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: cat.color,
                      boxShadow: `0 0 0 3px ${cat.color}20`,
                    }} />
                    <Text style={{ fontSize: 13 }}>{cat.emoji} {cat.name}</Text>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <Text strong style={{ fontSize: 14, color: cat.color }}>{formatAmount(cat.amount)}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>{cat.percent}%</Text>
                  </div>
                </div>
                <div style={{ height: 10, borderRadius: 5, background: colors.bg, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${cat.ratio * 100}%`,
                    borderRadius: 5,
                    background: `linear-gradient(90deg, ${cat.color}, ${cat.color}CC)`,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
