import { useMemo, useRef, useState, useCallback } from 'react'
import { Empty, theme } from 'antd'
import type { WeightRecord } from '@/shared/db'
import { useBodyStore } from '../store'
import { movingAverage } from '../utils'

export type DataType = 'weight' | 'bodyFat' | 'bmi'

interface Props {
  records: WeightRecord[]
  periodFilter: 'all' | 'morning' | 'evening'
  dataType: DataType
}

const PADDING = { top: 28, right: 48, bottom: 32, left: 48 }
const SVG_HEIGHT = 260
const MA_WINDOW = 7

const COLORS = {
  morning: '#1677ff',
  evening: '#fa8c16',
}

const DATA_META: Record<DataType, { unit: string; emptyText: string }> = {
  weight: { unit: 'kg', emptyText: '暂无体重数据' },
  bodyFat: { unit: '%', emptyText: '暂无体脂数据' },
  bmi: { unit: '', emptyText: '暂无 BMI 数据' },
}

function niceYTicks(min: number, max: number, targetCount = 5): number[] {
  const rawStep = (max - min) / targetCount
  if (rawStep <= 0) return [min]
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const residual = rawStep / magnitude
  let niceStep: number
  if (residual <= 1) niceStep = 1 * magnitude
  else if (residual <= 2) niceStep = 2 * magnitude
  else if (residual <= 5) niceStep = 5 * magnitude
  else niceStep = 10 * magnitude
  if (niceStep < 0.5) niceStep = 0.5
  const niceMin = Math.floor(min / niceStep) * niceStep
  const niceMax = Math.ceil(max / niceStep) * niceStep
  const ticks: number[] = []
  for (let v = niceMin; v <= niceMax + niceStep * 0.01; v += niceStep) {
    ticks.push(+v.toFixed(2))
  }
  return ticks
}

const periodLabel = (p: string) => (p === 'morning' ? '早晨' : p === 'evening' ? '晚上' : '其他')

function getVal(r: WeightRecord, dt: DataType): number | undefined {
  if (dt === 'weight') return r.weight
  if (dt === 'bodyFat') return r.bodyFat
  return r.bmi
}

export default function WeightChart({ records, periodFilter, dataType }: Props) {
  const goalWeight = useBodyStore((s) => s.goalWeight)
  const {
    token: { colorPrimary, colorError, colorTextSecondary, colorBorderSecondary },
  } = theme.useToken()
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const meta = DATA_META[dataType]
  const showGoalLine = dataType === 'weight' && goalWeight !== null
  // 双线仅在体重视图 + 全部时段下启用
  const isDualLine = dataType === 'weight' && periodFilter === 'all'

  // 过滤出有值的记录并排序
  const sorted = useMemo(
    () => [...records].filter((r) => getVal(r, dataType) != null)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt),
    [records, dataType],
  )
  const uniqueDates = useMemo(
    () => [...new Set(sorted.map((r) => r.date))].sort(),
    [sorted],
  )

  const morningRecords = useMemo(
    () => isDualLine ? sorted.filter((r) => r.period === 'morning') : [],
    [sorted, isDualLine],
  )
  const eveningRecords = useMemo(
    () => isDualLine ? sorted.filter((r) => r.period === 'evening') : [],
    [sorted, isDualLine],
  )

  const [containerWidth, setContainerWidth] = useState(400)
  const measuredRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const w = node.getBoundingClientRect().width
      if (w > 0) setContainerWidth(w)
      const ro = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (entry) setContainerWidth(entry.contentRect.width)
      })
      ro.observe(node)
    }
  }, [])

  if (sorted.length === 0) {
    return <Empty description={meta.emptyText} style={{ padding: 40 }} />
  }

  const values = sorted.map((r) => getVal(r, dataType)!)
  const allValues = showGoalLine ? [...values, goalWeight!] : values
  const minW = Math.min(...allValues)
  const maxW = Math.max(...allValues)
  const range = maxW - minW || 1

  const yTicks = niceYTicks(minW - range * 0.1, maxW + range * 0.1)
  const yMin = yTicks[0]!
  const yMax = yTicks[yTicks.length - 1]!
  const yRange = yMax - yMin || 1

  const dateCount = uniqueDates.length
  const MIN_POINT_GAP = 28
  const plotW_container = containerWidth - PADDING.left - PADDING.right
  const naturalGap = dateCount > 1 ? plotW_container / (dateCount - 1) : plotW_container
  const needsScroll = naturalGap < MIN_POINT_GAP && dateCount > 1
  const chartWidth = needsScroll
    ? PADDING.left + PADDING.right + (dateCount - 1) * MIN_POINT_GAP
    : containerWidth
  const plotW = chartWidth - PADDING.left - PADDING.right
  const plotH = SVG_HEIGHT - PADDING.top - PADDING.bottom

  const dateIdxMap = new Map(uniqueDates.map((d, i) => [d, i]))
  const toX = (date: string) => {
    const idx = dateIdxMap.get(date) ?? 0
    return PADDING.left + (dateCount === 1 ? plotW / 2 : (idx / (dateCount - 1)) * plotW)
  }
  const toY = (v: number) => PADDING.top + plotH - ((v - yMin) / yRange) * plotH

  const buildPaths = (recs: WeightRecord[]) => {
    if (recs.length === 0) return { line: '', area: '', pts: [] as [string, WeightRecord][] }
    const byDate = new Map<string, WeightRecord>()
    for (const r of recs) byDate.set(r.date, r)
    const pts = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
    if (pts.length < 2) return { line: '', area: '', pts }
    const line = pts.map(([d, r]) => `${toX(d)},${toY(getVal(r, dataType)!)}`).join(' ')
    const first = pts[0]!
    const last = pts[pts.length - 1]!
    const area = `M${toX(first[0])},${toY(getVal(first[1], dataType)!)} ` +
      pts.slice(1).map(([d, r]) => `L${toX(d)},${toY(getVal(r, dataType)!)}`).join(' ') +
      ` L${toX(last[0])},${PADDING.top + plotH} L${toX(first[0])},${PADDING.top + plotH} Z`
    return { line, area, pts }
  }

  const buildMA = (recs: WeightRecord[]) => {
    const byDate = new Map<string, WeightRecord>()
    for (const r of recs) byDate.set(r.date, r)
    const pts = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
    const data = pts.map(([d, r]) => ({ x: toX(d), y: getVal(r, dataType)! }))
    const ma = movingAverage(data, MA_WINDOW)
    if (ma.length === 0) return ''
    return ma.map((p) => `${p.x},${toY(p.y)}`).join(' ')
  }

  const singlePaths = !isDualLine ? buildPaths(sorted) : null
  const singleMA = !isDualLine ? buildMA(sorted) : null
  const mPaths = isDualLine ? buildPaths(morningRecords) : null
  const ePaths = isDualLine ? buildPaths(eveningRecords) : null
  const mMA = isDualLine ? buildMA(morningRecords) : null
  const eMA = isDualLine ? buildMA(eveningRecords) : null

  const handleInteraction = (clientX: number) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const x = clientX - rect.left + container.scrollLeft
    let closest = 0
    let minDist = Infinity
    for (let i = 0; i < uniqueDates.length; i++) {
      const dist = Math.abs(toX(uniqueDates[i]!) - x)
      if (dist < minDist) { minDist = dist; closest = i }
    }
    setActiveIdx(closest)
  }

  const activeDate = activeIdx !== null ? uniqueDates[activeIdx] : undefined
  const activeRecords = activeDate ? sorted.filter((r) => r.date === activeDate) : []
  const lastRecord = sorted[sorted.length - 1]!
  const lastVal = getVal(lastRecord, dataType)!

  const labelWidth = 42
  const maxLabels = Math.max(2, Math.floor(plotW / labelWidth))
  const labelInterval = Math.max(1, Math.ceil(dateCount / maxLabels))

  return (
    <div
      ref={(node) => { containerRef.current = node; measuredRef(node) }}
      style={{ overflowX: needsScroll ? 'auto' : 'hidden', WebkitOverflowScrolling: 'touch' }}
    >
      <svg
        width={chartWidth}
        height={SVG_HEIGHT}
        style={{ display: 'block', touchAction: needsScroll ? 'pan-x' : 'none' }}
        onTouchMove={(e) => { const t = e.touches[0]; if (t) handleInteraction(t.clientX) }}
        onTouchEnd={() => setTimeout(() => setActiveIdx(null), 1500)}
        onMouseMove={(e) => handleInteraction(e.clientX)}
        onMouseLeave={() => setActiveIdx(null)}
      >
        <defs>
          <linearGradient id="areaGradPrimary" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorPrimary} stopOpacity={0.2} />
            <stop offset="100%" stopColor={colorPrimary} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="areaGradMorning" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.morning} stopOpacity={0.15} />
            <stop offset="100%" stopColor={COLORS.morning} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="areaGradEvening" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.evening} stopOpacity={0.15} />
            <stop offset="100%" stopColor={COLORS.evening} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Y 轴 */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PADDING.left} y1={toY(v)} x2={chartWidth - PADDING.right} y2={toY(v)} stroke={colorBorderSecondary} strokeDasharray="4 2" />
            <text x={PADDING.left - 8} y={toY(v)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={colorTextSecondary}>
              {v % 1 === 0 ? v : v.toFixed(1)}
            </text>
          </g>
        ))}

        {/* X 轴 */}
        {uniqueDates.map((d, i) => {
          if (i % labelInterval !== 0 && i !== dateCount - 1) return null
          return <text key={d} x={toX(d)} y={SVG_HEIGHT - 8} textAnchor="middle" fontSize={10} fill={colorTextSecondary}>{d.slice(5)}</text>
        })}

        {/* 目标线 */}
        {showGoalLine && (
          <>
            <line x1={PADDING.left} y1={toY(goalWeight!)} x2={chartWidth - PADDING.right} y2={toY(goalWeight!)} stroke={colorError} strokeWidth={1.5} strokeDasharray="6 3" />
            <text x={chartWidth - PADDING.right + 4} y={toY(goalWeight!)} dominantBaseline="middle" fontSize={11} fill={colorError}>目标</text>
          </>
        )}

        {/* 单线模式 */}
        {!isDualLine && singlePaths && (
          <>
            <path d={singlePaths.area} fill="url(#areaGradPrimary)" />
            <polyline fill="none" stroke={colorPrimary} strokeWidth={2} strokeLinejoin="round" points={singlePaths.line} />
            {singleMA && <polyline fill="none" stroke={colorPrimary} strokeWidth={1.5} strokeDasharray="6 3" opacity={0.5} points={singleMA} />}
          </>
        )}

        {/* 双线模式 */}
        {isDualLine && (
          <>
            {mPaths && mPaths.area && (
              <>
                <path d={mPaths.area} fill="url(#areaGradMorning)" />
                <polyline fill="none" stroke={COLORS.morning} strokeWidth={2} strokeLinejoin="round" points={mPaths.line} />
                {mMA && <polyline fill="none" stroke={COLORS.morning} strokeWidth={1.5} strokeDasharray="6 3" opacity={0.5} points={mMA} />}
              </>
            )}
            {ePaths && ePaths.area && (
              <>
                <path d={ePaths.area} fill="url(#areaGradEvening)" />
                <polyline fill="none" stroke={COLORS.evening} strokeWidth={2} strokeLinejoin="round" points={ePaths.line} />
                {eMA && <polyline fill="none" stroke={COLORS.evening} strokeWidth={1.5} strokeDasharray="6 3" opacity={0.5} points={eMA} />}
              </>
            )}
          </>
        )}

        {/* 数据点 */}
        {sorted.map((r) => {
          const v = getVal(r, dataType)!
          const isActive = activeDate === r.date
          const color = isDualLine
            ? (r.period === 'morning' ? COLORS.morning : r.period === 'evening' ? COLORS.evening : colorPrimary)
            : colorPrimary
          return (
            <circle key={r.id} cx={toX(r.date)} cy={toY(v)} r={isActive ? 6 : r === lastRecord ? 5 : 3.5}
              fill={isActive ? colorError : color} stroke="#fff" strokeWidth={isActive || r === lastRecord ? 2 : 1.5} />
          )
        })}

        {/* 最新值标注 */}
        {activeIdx === null && (
          <text x={toX(lastRecord.date) + 8} y={toY(lastVal)} dominantBaseline="middle" fontSize={12} fontWeight={600}
            fill={isDualLine ? (lastRecord.period === 'morning' ? COLORS.morning : COLORS.evening) : colorPrimary}>
            {lastVal}{meta.unit}
          </text>
        )}

        {/* 激活竖线 */}
        {activeDate && (
          <line x1={toX(activeDate)} y1={PADDING.top} x2={toX(activeDate)} y2={SVG_HEIGHT - PADDING.bottom}
            stroke={colorTextSecondary} strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />
        )}

        {/* 图例 */}
        {isDualLine && (morningRecords.length > 0 || eveningRecords.length > 0) && (
          <g>
            {morningRecords.length > 0 && (<><line x1={PADDING.left} y1={12} x2={PADDING.left + 16} y2={12} stroke={COLORS.morning} strokeWidth={2} />
              <text x={PADDING.left + 20} y={12} dominantBaseline="middle" fontSize={11} fill={colorTextSecondary}>早晨</text></>)}
            {eveningRecords.length > 0 && (<><line x1={PADDING.left + 60} y1={12} x2={PADDING.left + 76} y2={12} stroke={COLORS.evening} strokeWidth={2} />
              <text x={PADDING.left + 80} y={12} dominantBaseline="middle" fontSize={11} fill={colorTextSecondary}>晚上</text></>)}
            <line x1={PADDING.left + 120} y1={12} x2={PADDING.left + 136} y2={12} stroke={colorTextSecondary} strokeWidth={1.5} strokeDasharray="6 3" opacity={0.5} />
            <text x={PADDING.left + 140} y={12} dominantBaseline="middle" fontSize={11} fill={colorTextSecondary}>7日均线</text>
          </g>
        )}
        {!isDualLine && singleMA && (
          <g>
            <line x1={PADDING.left} y1={12} x2={PADDING.left + 16} y2={12} stroke={colorPrimary} strokeWidth={1.5} strokeDasharray="6 3" opacity={0.5} />
            <text x={PADDING.left + 20} y={12} dominantBaseline="middle" fontSize={11} fill={colorTextSecondary}>7日均线</text>
          </g>
        )}
      </svg>

      {/* 悬浮信息 */}
      {activeRecords.length > 0 && (
        <div style={{ padding: '6px 12px', fontSize: 13, color: colorTextSecondary, textAlign: 'center', borderTop: `1px solid ${colorBorderSecondary}` }}>
          {activeRecords.map((r, i) => {
            const v = getVal(r, dataType)
            return (
              <span key={r.id}>
                {i > 0 && ' ｜ '}
                {isDualLine && <span style={{ color: r.period === 'morning' ? COLORS.morning : COLORS.evening }}>{periodLabel(r.period)}</span>}
                {isDualLine && ' '}
                <strong>{v}{meta.unit}</strong>
                {dataType === 'weight' && r.bmi != null && ` BMI ${r.bmi}`}
                {dataType === 'weight' && r.bodyFat != null && ` 体脂 ${r.bodyFat}%`}
              </span>
            )
          })}
          <span style={{ marginLeft: 8 }}>{activeDate}</span>
        </div>
      )}
    </div>
  )
}
