import { useMemo, useRef, useState, useCallback } from 'react'
import { Empty, Popover, theme } from 'antd'
import type { WeightRecord } from '@/shared/db'
import { useBodyStore } from '../store'

interface Props {
  records: WeightRecord[]
}

const PADDING = { top: 28, right: 24, bottom: 32, left: 48 }
const SVG_HEIGHT = 260

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

  // 用容器宽度做自适应
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
      return () => ro.disconnect()
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
  const yMin = minW - range * 0.1
  const yMax = maxW + range * 0.1
  const yRange = yMax - yMin

  const yTicks: number[] = []
  const step = Math.ceil(yRange / 5) || 1
  for (let v = Math.floor(yMin); v <= Math.ceil(yMax); v += step) {
    yTicks.push(v)
  }

  // 图表宽度：最少 = 容器宽度，数据多时可滚动
  const minDataWidth = sorted.length * 50
  const chartWidth = Math.max(minDataWidth, containerWidth)
  const plotW = chartWidth - PADDING.left - PADDING.right
  const plotH = SVG_HEIGHT - PADDING.top - PADDING.bottom

  const toX = (i: number) => PADDING.left + (sorted.length === 1 ? plotW / 2 : (i / (sorted.length - 1)) * plotW)
  const toY = (w: number) => PADDING.top + plotH - ((w - yMin) / yRange) * plotH

  const points = sorted.map((r, i) => `${toX(i)},${toY(r.weight)}`).join(' ')

  const periodLabel = (p: string) => (p === 'morning' ? '早晨' : p === 'evening' ? '晚上' : '其他')

  // 触摸 / 点击查找最近的数据点
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

  return (
    <div
      ref={(node) => { containerRef.current = node; measuredRef(node) }}
      style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
    >
      <svg
        width={chartWidth}
        height={SVG_HEIGHT}
        style={{ display: 'block', touchAction: 'pan-x' }}
        onTouchMove={(e) => {
          const touch = e.touches[0]
          if (touch) handleInteraction(touch.clientX)
        }}
        onTouchEnd={() => setTimeout(() => setActiveIdx(null), 1500)}
        onMouseMove={(e) => handleInteraction(e.clientX)}
        onMouseLeave={() => setActiveIdx(null)}
      >
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
              {v}
            </text>
          </g>
        ))}

        {/* X 轴日期标签（移动端间隔显示） */}
        {sorted.map((r, i) => {
          const labelInterval = chartWidth < 500 ? Math.max(1, Math.floor(sorted.length / 6)) : 1
          if (i % labelInterval !== 0 && i !== sorted.length - 1) return null
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

        {/* 折线 */}
        <polyline
          fill="none"
          stroke={colorPrimary}
          strokeWidth={2}
          points={points}
        />

        {/* 数据点 */}
        {sorted.map((r, i) => (
          <circle
            key={r.id}
            cx={toX(i)}
            cy={toY(r.weight)}
            r={activeIdx === i ? 6 : 4}
            fill={activeIdx === i ? colorError : colorPrimary}
            stroke="#fff"
            strokeWidth={2}
          />
        ))}

        {/* 激活点的竖线指示器 */}
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

      {/* 悬浮信息展示在图表下方，移动端友好 */}
      {activeRecord && (
        <Popover open={false}>
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
        </Popover>
      )}
    </div>
  )
}
