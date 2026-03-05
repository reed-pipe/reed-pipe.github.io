import { useMemo, useRef, useState, useCallback } from 'react'
import { Empty, theme } from 'antd'
import type { WeightRecord } from '@/shared/db'
import { useBodyStore } from '../store'
import { movingAverage } from '../utils'

interface Props {
  records: WeightRecord[]
  periodFilter: 'all' | 'morning' | 'evening'
}

const PADDING = { top: 28, right: 48, bottom: 32, left: 48 }
const SVG_HEIGHT = 260
const MA_WINDOW = 7

const COLORS = {
  morning: '#1677ff',
  evening: '#fa8c16',
}

/** 生成"好看"的 Y 轴刻度 */
function niceYTicks(min: number, max: number, targetCount = 5): number[] {
  const rawStep = (max - min) / targetCount
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

export default function WeightChart({ records, periodFilter }: Props) {
  const goalWeight = useBodyStore((s) => s.goalWeight)
  const {
    token: { colorPrimary, colorError, colorTextSecondary, colorBorderSecondary },
  } = theme.useToken()
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 按日期排序，提取唯一日期作为 X 轴
  const sorted = useMemo(
    () => [...records].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt),
    [records],
  )
  const uniqueDates = useMemo(
    () => [...new Set(sorted.map((r) => r.date))].sort(),
    [sorted],
  )

  // 双线模式：筛选全部时分早晚两条线
  const isDualLine = periodFilter === 'all'
  const morningRecords = useMemo(
    () => isDualLine ? sorted.filter((r) => r.period === 'morning') : [],
    [sorted, isDualLine],
  )
  const eveningRecords = useMemo(
    () => isDualLine ? sorted.filter((r) => r.period === 'evening') : [],
    [sorted, isDualLine],
  )

  // 容器宽度自适应
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
    return <Empty description="暂无数据" style={{ padding: 40 }} />
  }

  const weights = sorted.map((r) => r.weight)
  const allValues = goalWeight !== null ? [...weights, goalWeight] : weights
  const minW = Math.min(...allValues)
  const maxW = Math.max(...allValues)
  const range = maxW - minW || 1

  const yTicks = niceYTicks(minW - range * 0.1, maxW + range * 0.1)
  const yMin = yTicks[0]!
  const yMax = yTicks[yTicks.length - 1]!
  const yRange = yMax - yMin || 1

  // 自适应间距
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

  const dateIdx = new Map(uniqueDates.map((d, i) => [d, i]))
  const toX = (date: string) => {
    const idx = dateIdx.get(date) ?? 0
    return PADDING.left + (dateCount === 1 ? plotW / 2 : (idx / (dateCount - 1)) * plotW)
  }
  const toY = (w: number) => PADDING.top + plotH - ((w - yMin) / yRange) * plotH

  // 生成折线 + 面积路径
  const buildPaths = (recs: WeightRecord[]) => {
    if (recs.length === 0) return { line: '', area: '' }
    // 每个日期取最后一条记录
    const byDate = new Map<string, WeightRecord>()
    for (const r of recs) byDate.set(r.date, r)
    const pts = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
    const line = pts.map(([d, r]) => `${toX(d)},${toY(r.weight)}`).join(' ')
    const first = pts[0]!
    const last = pts[pts.length - 1]!
    const area = `M${toX(first[0])},${toY(first[1].weight)} ` +
      pts.slice(1).map(([d, r]) => `L${toX(d)},${toY(r.weight)}`).join(' ') +
      ` L${toX(last[0])},${PADDING.top + plotH} L${toX(first[0])},${PADDING.top + plotH} Z`
    return { line, area, pts }
  }

  // 移动平均
  const buildMA = (recs: WeightRecord[]) => {
    const byDate = new Map<string, WeightRecord>()
    for (const r of recs) byDate.set(r.date, r)
    const pts = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
    const data = pts.map(([d, r]) => ({ x: toX(d), y: r.weight }))
    const ma = movingAverage(data, MA_WINDOW)
    if (ma.length === 0) return ''
    return ma.map((p) => `${p.x},${toY(p.y)}`).join(' ')
  }

  // 单线模式数据
  const singlePaths = !isDualLine ? buildPaths(sorted) : null
  const singleMA = !isDualLine ? buildMA(sorted) : null

  // 双线模式数据
  const mPaths = isDualLine ? buildPaths(morningRecords) : null
  const ePaths = isDualLine ? buildPaths(eveningRecords) : null
  const mMA = isDualLine ? buildMA(morningRecords) : null
  const eMA = isDualLine ? buildMA(eveningRecords) : null

  // 触摸 / 鼠标交互 — 找最近日期
  const handleInteraction = (clientX: number) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const x = clientX - rect.left + container.scrollLeft
    let closest = 0
    let minDist = Infinity
    for (let i = 0; i < uniqueDates.length; i++) {
      const dx = toX(uniqueDates[i]!)
      const dist = Math.abs(dx - x)
      if (dist < minDist) {
        minDist = dist
        closest = i
      }
    }
    setActiveIdx(closest)
  }

  const activeDate = activeIdx !== null ? uniqueDates[activeIdx] : undefined
  const activeRecords = activeDate ? sorted.filter((r) => r.date === activeDate) : []

  // 最新记录（用于标注）
  const lastRecord = sorted[sorted.length - 1]!

  // X 轴标签智能间隔
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
        onTouchMove={(e) => {
          const touch = e.touches[0]
          if (touch) handleInteraction(touch.clientX)
        }}
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

        {/* Y 轴刻度 */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PADDING.left} y1={toY(v)} x2={chartWidth - PADDING.right} y2={toY(v)} stroke={colorBorderSecondary} strokeDasharray="4 2" />
            <text x={PADDING.left - 8} y={toY(v)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={colorTextSecondary}>
              {v % 1 === 0 ? v : v.toFixed(1)}
            </text>
          </g>
        ))}

        {/* X 轴日期 */}
        {uniqueDates.map((d, i) => {
          if (i % labelInterval !== 0 && i !== dateCount - 1) return null
          return (
            <text key={d} x={toX(d)} y={SVG_HEIGHT - 8} textAnchor="middle" fontSize={10} fill={colorTextSecondary}>
              {d.slice(5)}
            </text>
          )
        })}

        {/* 目标线 */}
        {goalWeight !== null && (
          <>
            <line x1={PADDING.left} y1={toY(goalWeight)} x2={chartWidth - PADDING.right} y2={toY(goalWeight)} stroke={colorError} strokeWidth={1.5} strokeDasharray="6 3" />
            <text x={chartWidth - PADDING.right + 4} y={toY(goalWeight)} dominantBaseline="middle" fontSize={11} fill={colorError}>目标</text>
          </>
        )}

        {/* --- 单线模式 --- */}
        {!isDualLine && singlePaths && (
          <>
            <path d={singlePaths.area} fill="url(#areaGradPrimary)" />
            <polyline fill="none" stroke={colorPrimary} strokeWidth={2} strokeLinejoin="round" points={singlePaths.line} />
            {singleMA && <polyline fill="none" stroke={colorPrimary} strokeWidth={1.5} strokeDasharray="6 3" opacity={0.5} points={singleMA} />}
          </>
        )}

        {/* --- 双线模式 --- */}
        {isDualLine && (
          <>
            {/* 早晨线 */}
            {mPaths && mPaths.area && (
              <>
                <path d={mPaths.area} fill="url(#areaGradMorning)" />
                <polyline fill="none" stroke={COLORS.morning} strokeWidth={2} strokeLinejoin="round" points={mPaths.line} />
                {mMA && <polyline fill="none" stroke={COLORS.morning} strokeWidth={1.5} strokeDasharray="6 3" opacity={0.5} points={mMA} />}
              </>
            )}
            {/* 晚上线 */}
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
          const isActive = activeDate === r.date
          const color = isDualLine
            ? (r.period === 'morning' ? COLORS.morning : r.period === 'evening' ? COLORS.evening : colorPrimary)
            : colorPrimary
          return (
            <circle
              key={r.id}
              cx={toX(r.date)}
              cy={toY(r.weight)}
              r={isActive ? 6 : r === lastRecord ? 5 : 3.5}
              fill={isActive ? colorError : color}
              stroke="#fff"
              strokeWidth={isActive || r === lastRecord ? 2 : 1.5}
            />
          )
        })}

        {/* 最新值标注 */}
        {activeIdx === null && (
          <text
            x={toX(lastRecord.date) + 8}
            y={toY(lastRecord.weight)}
            dominantBaseline="middle"
            fontSize={12}
            fontWeight={600}
            fill={isDualLine
              ? (lastRecord.period === 'morning' ? COLORS.morning : COLORS.evening)
              : colorPrimary}
          >
            {lastRecord.weight}
          </text>
        )}

        {/* 激活竖线 */}
        {activeDate && (
          <line
            x1={toX(activeDate)}
            y1={PADDING.top}
            x2={toX(activeDate)}
            y2={SVG_HEIGHT - PADDING.bottom}
            stroke={colorTextSecondary}
            strokeWidth={1}
            strokeDasharray="3 2"
            opacity={0.5}
          />
        )}

        {/* 图例（双线模式） */}
        {isDualLine && (morningRecords.length > 0 || eveningRecords.length > 0) && (
          <g>
            {morningRecords.length > 0 && (
              <>
                <line x1={PADDING.left} y1={12} x2={PADDING.left + 16} y2={12} stroke={COLORS.morning} strokeWidth={2} />
                <text x={PADDING.left + 20} y={12} dominantBaseline="middle" fontSize={11} fill={colorTextSecondary}>早晨</text>
              </>
            )}
            {eveningRecords.length > 0 && (
              <>
                <line x1={PADDING.left + 60} y1={12} x2={PADDING.left + 76} y2={12} stroke={COLORS.evening} strokeWidth={2} />
                <text x={PADDING.left + 80} y={12} dominantBaseline="middle" fontSize={11} fill={colorTextSecondary}>晚上</text>
              </>
            )}
            <line x1={PADDING.left + 120} y1={12} x2={PADDING.left + 136} y2={12} stroke={colorTextSecondary} strokeWidth={1.5} strokeDasharray="6 3" opacity={0.5} />
            <text x={PADDING.left + 140} y={12} dominantBaseline="middle" fontSize={11} fill={colorTextSecondary}>7日均线</text>
          </g>
        )}

        {/* 图例（单线模式，有移动平均时显示） */}
        {!isDualLine && singleMA && (
          <g>
            <line x1={PADDING.left} y1={12} x2={PADDING.left + 16} y2={12} stroke={colorPrimary} strokeWidth={1.5} strokeDasharray="6 3" opacity={0.5} />
            <text x={PADDING.left + 20} y={12} dominantBaseline="middle" fontSize={11} fill={colorTextSecondary}>7日均线</text>
          </g>
        )}
      </svg>

      {/* 悬浮信息 */}
      {activeRecords.length > 0 && (
        <div
          style={{
            padding: '6px 12px',
            fontSize: 13,
            color: colorTextSecondary,
            textAlign: 'center',
            borderTop: `1px solid ${colorBorderSecondary}`,
          }}
        >
          {activeRecords.map((r, i) => (
            <span key={r.id}>
              {i > 0 && ' ｜ '}
              {isDualLine && <span style={{ color: r.period === 'morning' ? COLORS.morning : COLORS.evening }}>{periodLabel(r.period)}</span>}
              {isDualLine && ' '}
              <strong>{r.weight} kg</strong>
              {r.bmi != null && ` BMI ${r.bmi}`}
              {r.bodyFat != null && ` 体脂 ${r.bodyFat}%`}
            </span>
          ))}
          <span style={{ marginLeft: 8 }}>{activeDate}</span>
        </div>
      )}
    </div>
  )
}
