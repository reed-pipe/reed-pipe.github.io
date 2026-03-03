import { useMemo, useState } from 'react'
import { Empty, Tooltip, theme } from 'antd'
import type { WeightRecord } from '@/shared/db'
import { useBodyStore } from '../store'

interface Props {
  records: WeightRecord[]
}

const PADDING = { top: 28, right: 24, bottom: 32, left: 48 }
const SVG_HEIGHT = 300

export default function WeightChart({ records }: Props) {
  const goalWeight = useBodyStore((s) => s.goalWeight)
  const {
    token: { colorPrimary, colorError, colorTextSecondary, colorBorderSecondary },
  } = theme.useToken()
  const [tooltip, setTooltip] = useState<{ record: WeightRecord } | null>(null)

  const sorted = useMemo(
    () => [...records].sort((a, b) => a.createdAt - b.createdAt),
    [records],
  )

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

  // 生成 Y 轴刻度
  const yTicks: number[] = []
  const step = Math.ceil(yRange / 5) || 1
  for (let v = Math.floor(yMin); v <= Math.ceil(yMax); v += step) {
    yTicks.push(v)
  }

  const chartWidth = Math.max(sorted.length * 60, 400)
  const plotW = chartWidth - PADDING.left - PADDING.right
  const plotH = SVG_HEIGHT - PADDING.top - PADDING.bottom

  const toX = (i: number) => PADDING.left + (sorted.length === 1 ? plotW / 2 : (i / (sorted.length - 1)) * plotW)
  const toY = (w: number) => PADDING.top + plotH - ((w - yMin) / yRange) * plotH

  const points = sorted.map((r, i) => `${toX(i)},${toY(r.weight)}`).join(' ')

  const periodLabel = (p: string) => (p === 'morning' ? '早晨' : p === 'evening' ? '晚上' : '其他')

  return (
    <div style={{ overflowX: 'auto' }}>
      <Tooltip
        open={tooltip !== null}
        title={
          tooltip ? (
            <div>
              <div>{tooltip.record.date} {periodLabel(tooltip.record.period)}</div>
              <div>{tooltip.record.weight} kg{tooltip.record.bmi != null ? ` / BMI ${tooltip.record.bmi}` : ''}</div>
            </div>
          ) : null
        }
        placement="top"
      >
        <svg
          width={chartWidth}
          height={SVG_HEIGHT}
          style={{ display: 'block' }}
          onMouseLeave={() => setTooltip(null)}
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

          {/* X 轴日期标签 */}
          {sorted.map((r, i) => (
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
          ))}

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
              r={4}
              fill={colorPrimary}
              stroke="#fff"
              strokeWidth={2}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setTooltip({ record: r })}
              onMouseLeave={() => setTooltip(null)}
            />
          ))}
        </svg>
      </Tooltip>
    </div>
  )
}
