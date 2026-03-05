import { useMemo, useRef, useState, useCallback } from 'react'
import { Empty, Segmented, theme } from 'antd'
import type { BodyMeasurement } from '@/shared/db'

interface Props {
  records: BodyMeasurement[]
}

const PADDING = { top: 28, right: 48, bottom: 32, left: 48 }
const SVG_HEIGHT = 240

type MetricKey = 'waist' | 'hip' | 'chest' | 'arm' | 'thigh'

const metricOptions: { value: MetricKey; label: string }[] = [
  { value: 'waist', label: '腰围' },
  { value: 'hip', label: '臀围' },
  { value: 'chest', label: '胸围' },
  { value: 'arm', label: '臂围' },
  { value: 'thigh', label: '腿围' },
]

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

export default function MeasurementChart({ records }: Props) {
  const [metric, setMetric] = useState<MetricKey>('waist')
  const {
    token: { colorPrimary, colorTextSecondary, colorBorderSecondary },
  } = theme.useToken()
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 过滤出有该指标数据的记录
  const filtered = useMemo(() => {
    return records
      .filter((r) => r[metric] != null)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
  }, [records, metric])

  // 每日去重（取最新）
  const byDate = useMemo(() => {
    const map = new Map<string, typeof filtered[0]>()
    for (const r of filtered) map.set(r.date, r)
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  // 检测可用的指标（有数据的才显示）
  const availableMetrics = useMemo(() => {
    return metricOptions.filter((opt) => records.some((r) => r[opt.value] != null))
  }, [records])

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

  if (records.length === 0) {
    return <Empty description="暂无围度数据" style={{ padding: 40 }} />
  }

  if (byDate.length === 0) {
    return (
      <div>
        <Segmented size="small" options={availableMetrics.length > 0 ? availableMetrics : metricOptions} value={metric} onChange={(v) => setMetric(v as MetricKey)} style={{ marginBottom: 16 }} />
        <Empty description={`暂无${metricOptions.find((o) => o.value === metric)?.label}数据`} style={{ padding: 40 }} />
      </div>
    )
  }

  const values = byDate.map(([, r]) => r[metric]!)
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const range = maxV - minV || 1

  const yTicks = niceYTicks(minV - range * 0.1, maxV + range * 0.1)
  const yMin = yTicks[0]!
  const yMax = yTicks[yTicks.length - 1]!
  const yRange = yMax - yMin || 1

  const n = byDate.length
  const MIN_GAP = 28
  const plotWContainer = containerWidth - PADDING.left - PADDING.right
  const naturalGap = n > 1 ? plotWContainer / (n - 1) : plotWContainer
  const needsScroll = naturalGap < MIN_GAP && n > 1
  const chartWidth = needsScroll ? PADDING.left + PADDING.right + (n - 1) * MIN_GAP : containerWidth
  const plotW = chartWidth - PADDING.left - PADDING.right
  const plotH = SVG_HEIGHT - PADDING.top - PADDING.bottom

  const toX = (i: number) => PADDING.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const toY = (v: number) => PADDING.top + plotH - ((v - yMin) / yRange) * plotH

  const linePoints = byDate.map(([, r], i) => `${toX(i)},${toY(r[metric]!)}`).join(' ')
  const first = byDate[0]!
  const last = byDate[byDate.length - 1]!
  const areaPath = `M${toX(0)},${toY(first[1][metric]!)} ` +
    byDate.slice(1).map(([, r], i) => `L${toX(i + 1)},${toY(r[metric]!)}`).join(' ') +
    ` L${toX(n - 1)},${PADDING.top + plotH} L${toX(0)},${PADDING.top + plotH} Z`

  const handleInteraction = (clientX: number) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const x = clientX - rect.left + container.scrollLeft
    let closest = 0
    let minDist = Infinity
    for (let i = 0; i < n; i++) {
      const dist = Math.abs(toX(i) - x)
      if (dist < minDist) { minDist = dist; closest = i }
    }
    setActiveIdx(closest)
  }

  const activeRecord = activeIdx !== null ? byDate[activeIdx] : undefined
  const labelWidth = 42
  const maxLabels = Math.max(2, Math.floor(plotW / labelWidth))
  const labelInterval = Math.max(1, Math.ceil(n / maxLabels))
  const metricLabel = metricOptions.find((o) => o.value === metric)?.label ?? metric

  return (
    <div>
      <Segmented
        size="small"
        options={availableMetrics.length > 0 ? availableMetrics : metricOptions}
        value={metric}
        onChange={(v) => { setMetric(v as MetricKey); setActiveIdx(null) }}
        style={{ marginBottom: 12 }}
      />
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
            <linearGradient id="measAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colorPrimary} stopOpacity={0.2} />
              <stop offset="100%" stopColor={colorPrimary} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PADDING.left} y1={toY(v)} x2={chartWidth - PADDING.right} y2={toY(v)} stroke={colorBorderSecondary} strokeDasharray="4 2" />
              <text x={PADDING.left - 8} y={toY(v)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={colorTextSecondary}>
                {v % 1 === 0 ? v : v.toFixed(1)}
              </text>
            </g>
          ))}

          {byDate.map(([d], i) => {
            if (i % labelInterval !== 0 && i !== n - 1) return null
            return <text key={d} x={toX(i)} y={SVG_HEIGHT - 8} textAnchor="middle" fontSize={10} fill={colorTextSecondary}>{d.slice(5)}</text>
          })}

          <path d={areaPath} fill="url(#measAreaGrad)" />
          <polyline fill="none" stroke={colorPrimary} strokeWidth={2} strokeLinejoin="round" points={linePoints} />

          {byDate.map(([, r], i) => (
            <circle
              key={r.id}
              cx={toX(i)}
              cy={toY(r[metric]!)}
              r={activeIdx === i ? 6 : i === n - 1 ? 5 : 3.5}
              fill={activeIdx === i ? '#ff4d4f' : colorPrimary}
              stroke="#fff"
              strokeWidth={activeIdx === i || i === n - 1 ? 2 : 1.5}
            />
          ))}

          {activeIdx === null && (
            <text x={toX(n - 1) + 8} y={toY(last[1][metric]!)} dominantBaseline="middle" fontSize={12} fontWeight={600} fill={colorPrimary}>
              {last[1][metric]}
            </text>
          )}

          {activeIdx !== null && (
            <line x1={toX(activeIdx)} y1={PADDING.top} x2={toX(activeIdx)} y2={SVG_HEIGHT - PADDING.bottom} stroke={colorTextSecondary} strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />
          )}
        </svg>

        {activeRecord && (
          <div style={{ padding: '6px 12px', fontSize: 13, color: colorTextSecondary, textAlign: 'center', borderTop: `1px solid ${colorBorderSecondary}` }}>
            {activeRecord[0]} · <strong>{metricLabel} {activeRecord[1][metric]} cm</strong>
            {activeRecord[1].note && ` · ${activeRecord[1].note}`}
          </div>
        )}
      </div>
    </div>
  )
}
