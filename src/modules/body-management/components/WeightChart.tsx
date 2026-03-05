import { useMemo, useRef, useState, useCallback } from 'react'
import { Empty, theme } from 'antd'
import type { WeightRecord } from '@/shared/db'
import { useBodyStore } from '../store'

interface Props {
  records: WeightRecord[]
}

const PADDING = { top: 28, right: 48, bottom: 32, left: 48 }
const SVG_HEIGHT = 260

/** 生成"好看"的 Y 轴刻度：对齐到 0.5 / 1 / 2 / 5 的整数倍 */
function niceYTicks(min: number, max: number, targetCount = 5): number[] {
  const rawStep = (max - min) / targetCount
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const residual = rawStep / magnitude
  let niceStep: number
  if (residual <= 1) niceStep = 1 * magnitude
  else if (residual <= 2) niceStep = 2 * magnitude
  else if (residual <= 5) niceStep = 5 * magnitude
  else niceStep = 10 * magnitude
  // 确保最小步长 0.5
  if (niceStep < 0.5) niceStep = 0.5

  const niceMin = Math.floor(min / niceStep) * niceStep
  const niceMax = Math.ceil(max / niceStep) * niceStep
  const ticks: number[] = []
  for (let v = niceMin; v <= niceMax + niceStep * 0.01; v += niceStep) {
    ticks.push(+v.toFixed(2))
  }
  return ticks
}

export default function WeightChart({ records }: Props) {
  const goalWeight = useBodyStore((s) => s.goalWeight)
  const {
    token: { colorPrimary, colorError, colorTextSecondary, colorBorderSecondary },
  } = theme.useToken()
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const sorted = useMemo(
    () => [...records].sort((a, b) => a.createdAt - b.createdAt),
    [records],
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

  // 自适应：数据量少时撑满容器，数据多时允许滚动但间距不低于 28px
  const MIN_POINT_GAP = 28
  const plotW_container = containerWidth - PADDING.left - PADDING.right
  const naturalGap = sorted.length > 1 ? plotW_container / (sorted.length - 1) : plotW_container
  const needsScroll = naturalGap < MIN_POINT_GAP && sorted.length > 1
  const chartWidth = needsScroll
    ? PADDING.left + PADDING.right + (sorted.length - 1) * MIN_POINT_GAP
    : containerWidth
  const plotW = chartWidth - PADDING.left - PADDING.right
  const plotH = SVG_HEIGHT - PADDING.top - PADDING.bottom

  const toX = (i: number) => PADDING.left + (sorted.length === 1 ? plotW / 2 : (i / (sorted.length - 1)) * plotW)
  const toY = (w: number) => PADDING.top + plotH - ((w - yMin) / yRange) * plotH

  const linePoints = sorted.map((r, i) => `${toX(i)},${toY(r.weight)}`).join(' ')
  // 面积填充的路径：折线 → 右下 → 左下 → 闭合
  const areaPath = sorted.length > 0
    ? `M${toX(0)},${toY(sorted[0]!.weight)} ` +
      sorted.slice(1).map((r, i) => `L${toX(i + 1)},${toY(r.weight)}`).join(' ') +
      ` L${toX(sorted.length - 1)},${PADDING.top + plotH} L${toX(0)},${PADDING.top + plotH} Z`
    : ''

  const periodLabel = (p: string) => (p === 'morning' ? '早晨' : p === 'evening' ? '晚上' : '其他')

  // 最新数据点
  const lastIdx = sorted.length - 1
  const lastRecord = sorted[lastIdx]

  // 触摸 / 鼠标查找最近数据点
  const handleInteraction = (clientX: number) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const x = clientX - rect.left + container.scrollLeft
    let closest = 0
    let minDist = Infinity
    for (let i = 0; i < sorted.length; i++) {
      const dist = Math.abs(toX(i) - x)
      if (dist < minDist) {
        minDist = dist
        closest = i
      }
    }
    setActiveIdx(closest)
  }

  const activeRecord = activeIdx !== null ? sorted[activeIdx] : undefined

  // X 轴标签间隔：确保标签不重叠
  const labelWidth = 42
  const maxLabels = Math.max(2, Math.floor(plotW / labelWidth))
  const labelInterval = Math.max(1, Math.ceil(sorted.length / maxLabels))

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
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorPrimary} stopOpacity={0.25} />
            <stop offset="100%" stopColor={colorPrimary} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Y 轴刻度线 + 标签 */}
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PADDING.left}
              y1={toY(v)}
              x2={chartWidth - PADDING.right}
              y2={toY(v)}
              stroke={colorBorderSecondary}
              strokeDasharray="4 2"
            />
            <text
              x={PADDING.left - 8}
              y={toY(v)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              fill={colorTextSecondary}
            >
              {v % 1 === 0 ? v : v.toFixed(1)}
            </text>
          </g>
        ))}

        {/* X 轴日期标签 */}
        {sorted.map((r, i) => {
          if (i % labelInterval !== 0 && i !== lastIdx) return null
          return (
            <text
              key={r.id}
              x={toX(i)}
              y={SVG_HEIGHT - 8}
              textAnchor="middle"
              fontSize={10}
              fill={colorTextSecondary}
            >
              {r.date.slice(5)}
            </text>
          )
        })}

        {/* 目标线 */}
        {goalWeight !== null && (
          <>
            <line
              x1={PADDING.left}
              y1={toY(goalWeight)}
              x2={chartWidth - PADDING.right}
              y2={toY(goalWeight)}
              stroke={colorError}
              strokeWidth={1.5}
              strokeDasharray="6 3"
            />
            <text
              x={chartWidth - PADDING.right + 4}
              y={toY(goalWeight)}
              dominantBaseline="middle"
              fontSize={11}
              fill={colorError}
            >
              目标
            </text>
          </>
        )}

        {/* 渐变面积填充 */}
        <path d={areaPath} fill="url(#areaGradient)" />

        {/* 折线 */}
        <polyline
          fill="none"
          stroke={colorPrimary}
          strokeWidth={2}
          strokeLinejoin="round"
          points={linePoints}
        />

        {/* 数据点 */}
        {sorted.map((r, i) => (
          <circle
            key={r.id}
            cx={toX(i)}
            cy={toY(r.weight)}
            r={activeIdx === i ? 6 : i === lastIdx ? 5 : 3.5}
            fill={activeIdx === i ? colorError : i === lastIdx ? colorPrimary : colorPrimary}
            stroke="#fff"
            strokeWidth={activeIdx === i || i === lastIdx ? 2 : 1.5}
          />
        ))}

        {/* 最新值标注 */}
        {activeIdx === null && lastRecord && (
          <text
            x={toX(lastIdx) + 8}
            y={toY(lastRecord.weight)}
            dominantBaseline="middle"
            fontSize={12}
            fontWeight={600}
            fill={colorPrimary}
          >
            {lastRecord.weight}
          </text>
        )}

        {/* 激活点竖线指示器 */}
        {activeIdx !== null && (
          <line
            x1={toX(activeIdx)}
            y1={PADDING.top}
            x2={toX(activeIdx)}
            y2={SVG_HEIGHT - PADDING.bottom}
            stroke={colorTextSecondary}
            strokeWidth={1}
            strokeDasharray="3 2"
            opacity={0.5}
          />
        )}
      </svg>

      {/* 悬浮信息 */}
      {activeRecord && (
        <div
          style={{
            padding: '6px 12px',
            fontSize: 13,
            color: colorTextSecondary,
            textAlign: 'center',
            borderTop: `1px solid ${colorBorderSecondary}`,
          }}
        >
          {activeRecord.date} {periodLabel(activeRecord.period)}
          {' · '}
          <strong>{activeRecord.weight} kg</strong>
          {activeRecord.bmi != null && ` · BMI ${activeRecord.bmi}`}
        </div>
      )}
    </div>
  )
}
