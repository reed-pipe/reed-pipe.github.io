import { useMemo } from 'react'
import { Empty, theme, Tooltip } from 'antd'
import type { WeightRecord } from '@/shared/db'

interface Props {
  records: WeightRecord[]
}

const CELL = 13
const GAP = 2
const MONTHS = 4

const WEEK_LABELS = ['', '一', '', '三', '', '五', '']

export default function CalendarHeatmap({ records }: Props) {
  const {
    token: { colorSuccess, colorError, colorTextSecondary, colorBorderSecondary, colorBgLayout },
  } = theme.useToken()

  // 按日期取每天最新体重
  const dateMap = useMemo(() => {
    const map = new Map<string, number>()
    const sorted = [...records].sort((a, b) => a.createdAt - b.createdAt)
    for (const r of sorted) map.set(r.date, r.weight)
    return map
  }, [records])

  // 生成日期格子：最近 N 个月
  const { days, weeks, monthLabels } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(today)
    start.setMonth(start.getMonth() - MONTHS)
    // 对齐到周一
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))

    const days: { date: string; dayOfWeek: number; weekIdx: number }[] = []
    const d = new Date(start)
    let weekIdx = 0
    const monthSet = new Map<string, number>() // "YYYY-MM" → first weekIdx

    while (d <= today) {
      const key = d.toISOString().slice(0, 10)
      const dow = (d.getDay() + 6) % 7 // 0=周一
      days.push({ date: key, dayOfWeek: dow, weekIdx })
      const monthKey = key.slice(0, 7)
      if (!monthSet.has(monthKey)) monthSet.set(monthKey, weekIdx)
      if (dow === 6) weekIdx++
      d.setDate(d.getDate() + 1)
    }

    const monthLabels = [...monthSet.entries()].map(([m, w]) => ({
      label: parseInt(m.slice(5)) + '月',
      weekIdx: w,
    }))

    return { days, weeks: weekIdx + 1, monthLabels }
  }, [])

  // 计算每日与前一记录的变化
  const changeMap = useMemo(() => {
    const sorted = [...dateMap.entries()].sort(([a], [b]) => a.localeCompare(b))
    const map = new Map<string, number>()
    for (let i = 1; i < sorted.length; i++) {
      const [date, weight] = sorted[i]!
      const prevWeight = sorted[i - 1]![1]
      map.set(date, weight - prevWeight)
    }
    return map
  }, [dateMap])

  if (records.length === 0) {
    return <Empty description="暂无数据" style={{ padding: 40 }} />
  }

  const getColor = (date: string) => {
    if (!dateMap.has(date)) return colorBgLayout
    const change = changeMap.get(date)
    if (change == null) return '#91caff' // 首条记录
    if (change < -0.5) return colorSuccess
    if (change < -0.1) return '#b7eb8f'
    if (change > 0.5) return colorError
    if (change > 0.1) return '#ffccc7'
    return '#d9d9d9' // 持平
  }

  const getTooltip = (date: string) => {
    const w = dateMap.get(date)
    if (w == null) return `${date} 无记录`
    const change = changeMap.get(date)
    const changeStr = change != null ? ` (${change > 0 ? '+' : ''}${change.toFixed(1)}kg)` : ''
    return `${date}: ${w}kg${changeStr}`
  }

  const svgW = (weeks + 1) * (CELL + GAP) + 24
  const svgH = 7 * (CELL + GAP) + 28

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <svg width={svgW} height={svgH} style={{ display: 'block' }}>
        {/* 周标签 */}
        {WEEK_LABELS.map((label, i) => (
          label && <text key={i} x={8} y={24 + i * (CELL + GAP) + CELL / 2} dominantBaseline="middle" textAnchor="end" fontSize={10} fill={colorTextSecondary}>{label}</text>
        ))}

        {/* 月标签 */}
        {monthLabels.map(({ label, weekIdx }) => (
          <text key={label} x={16 + weekIdx * (CELL + GAP)} y={10} fontSize={10} fill={colorTextSecondary}>{label}</text>
        ))}

        {/* 格子 */}
        {days.map(({ date, dayOfWeek, weekIdx }) => (
          <Tooltip key={date} title={getTooltip(date)} placement="top">
            <rect
              x={16 + weekIdx * (CELL + GAP)}
              y={18 + dayOfWeek * (CELL + GAP)}
              width={CELL}
              height={CELL}
              rx={2}
              fill={getColor(date)}
              stroke={colorBorderSecondary}
              strokeWidth={0.5}
              style={{ cursor: 'default' }}
            />
          </Tooltip>
        ))}
      </svg>

      {/* 图例 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: colorTextSecondary, padding: '4px 0 0 16px' }}>
        <span>减重</span>
        {[colorSuccess, '#b7eb8f', '#d9d9d9', '#ffccc7', colorError].map((c, i) => (
          <span key={i} style={{ width: 12, height: 12, borderRadius: 2, background: c, display: 'inline-block' }} />
        ))}
        <span>增重</span>
        <span style={{ marginLeft: 8, width: 12, height: 12, borderRadius: 2, background: colorBgLayout, display: 'inline-block', border: `0.5px solid ${colorBorderSecondary}` }} />
        <span>无记录</span>
      </div>
    </div>
  )
}
