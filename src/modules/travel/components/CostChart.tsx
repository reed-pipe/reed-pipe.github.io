import { useMemo } from 'react'
import { Typography, Empty } from 'antd'
import type { TripSpot } from '@/shared/db'
import { COST_CATEGORIES, formatCost, sortSpots, T } from '../utils'
import { colors } from '@/shared/theme'

const { Text } = Typography

interface Props {
  spots: TripSpot[]
  tripTotalCost?: number
}

/** Mini donut chart */
function DonutChart({ data, size = 120 }: { data: { color: string; amount: number }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.amount, 0)
  if (total === 0) return null

  const r = (size - 16) / 2
  const cx = size / 2
  const cy = size / 2
  const strokeWidth = 18

  let startAngle = -90
  const segments = data.map(d => {
    const angle = (d.amount / total) * 360
    const seg = { ...d, startAngle, angle }
    startAngle += angle
    return seg
  })

  function arcPath(start: number, angle: number) {
    const s = (start * Math.PI) / 180
    const e = ((start + angle) * Math.PI) / 180
    const large = angle > 180 ? 1 : 0
    return `M ${cx + r * Math.cos(s)} ${cy + r * Math.sin(s)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(e)} ${cy + r * Math.sin(e)}`
  }

  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      {/* Background ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={colors.bg} strokeWidth={strokeWidth} />
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
    </svg>
  )
}

export default function CostChart({ spots, tripTotalCost }: Props) {
  const categoryData = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of spots) {
      if (s.cost && s.cost > 0) {
        const cat = s.costCategory ?? 'other'
        map.set(cat, (map.get(cat) ?? 0) + s.cost)
      }
    }
    return COST_CATEGORIES
      .map(c => ({ ...c, amount: map.get(c.value) ?? 0 }))
      .filter(c => c.amount > 0)
      .sort((a, b) => b.amount - a.amount)
  }, [spots])

  const spotTotal = useMemo(() => spots.reduce((s, sp) => s + (sp.cost ?? 0), 0), [spots])
  const total = tripTotalCost ?? spotTotal
  const maxAmount = categoryData.length > 0 ? categoryData[0]!.amount : 0

  const spotCosts = useMemo(() => {
    return sortSpots(spots)
      .filter(s => s.cost && s.cost > 0)
      .map(s => ({
        name: s.name,
        cost: s.cost!,
        category: s.costCategory,
        date: s.date,
      }))
  }, [spots])

  if (spotCosts.length === 0 && !tripTotalCost) {
    return <Empty description="暂无花费数据" style={{ padding: 32 }} />
  }

  return (
    <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Total + Donut */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24,
        padding: '20px 16px',
        borderRadius: 18,
        background: T.gradientLight,
        border: `1px solid rgba(245,114,45,0.08)`,
      }}>
        {categoryData.length > 1 && (
          <DonutChart data={categoryData.map(c => ({ color: c.color, amount: c.amount }))} />
        )}
        <div style={{ textAlign: categoryData.length > 1 ? 'left' : 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>总花费</Text>
          <div style={{ fontSize: 30, fontWeight: 800, color: T.primary, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            {formatCost(total)}
          </div>
          {tripTotalCost && spotTotal > 0 && spotTotal !== tripTotalCost && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              地点合计 {formatCost(spotTotal)}
            </Text>
          )}
        </div>
      </div>

      {/* Category bars */}
      {categoryData.length > 0 && (
        <div>
          <Text strong style={{ fontSize: 13, marginBottom: 12, display: 'block' }}>分类统计</Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {categoryData.map(cat => (
              <div key={cat.value}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: cat.color,
                      boxShadow: `0 0 0 3px ${cat.color}20`,
                    }} />
                    <Text style={{ fontSize: 13 }}>{cat.emoji} {cat.label}</Text>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <Text strong style={{ fontSize: 14, color: cat.color }}>
                      {formatCost(cat.amount)}
                    </Text>
                    {total > 0 && (
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {Math.round(cat.amount / total * 100)}%
                      </Text>
                    )}
                  </div>
                </div>
                <div style={{
                  height: 10, borderRadius: 5,
                  background: colors.bg,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${maxAmount > 0 ? (cat.amount / maxAmount) * 100 : 0}%`,
                    borderRadius: 5,
                    background: `linear-gradient(90deg, ${cat.color}, ${cat.color}CC)`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.3)`,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-spot list */}
      {spotCosts.length > 0 && (
        <div>
          <Text strong style={{ fontSize: 13, marginBottom: 10, display: 'block' }}>地点明细</Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {spotCosts.map((s, i) => {
              const catInfo = COST_CATEGORIES.find(c => c.value === (s.category ?? 'other'))
              return (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', borderRadius: 12,
                  background: colors.bg,
                  border: `1px solid ${colors.borderLight}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 10,
                      background: `${catInfo?.color ?? colors.textTertiary}10`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, flexShrink: 0,
                    }}>
                      {catInfo?.emoji ?? '💰'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <Text style={{ fontSize: 13, display: 'block', fontWeight: 500 }} ellipsis>{s.name}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>{s.date}</Text>
                    </div>
                  </div>
                  <Text strong style={{
                    fontSize: 14, color: colors.gold, flexShrink: 0,
                    fontWeight: 700,
                  }}>
                    {formatCost(s.cost)}
                  </Text>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
