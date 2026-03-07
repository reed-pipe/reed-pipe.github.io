import { useMemo } from 'react'
import { Typography, Empty } from 'antd'
import type { TripSpot } from '@/shared/db'
import { COST_CATEGORIES, formatCost, sortSpots, T } from '../utils'

const { Text } = Typography

interface Props {
  spots: TripSpot[]
  tripTotalCost?: number
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

  // Per-spot breakdown
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Total summary */}
      <div style={{
        textAlign: 'center', padding: '16px 0',
        ...T.glassCard,
        background: T.gradientLight,
      }}>
        <Text type="secondary" style={{ fontSize: 12 }}>总花费</Text>
        <div style={{ fontSize: 28, fontWeight: 700, color: T.primary, lineHeight: 1.3 }}>
          {formatCost(total)}
        </div>
        {tripTotalCost && spotTotal > 0 && spotTotal !== tripTotalCost && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            地点合计 {formatCost(spotTotal)}
          </Text>
        )}
      </div>

      {/* Category bars */}
      {categoryData.length > 0 && (
        <div>
          <Text strong style={{ fontSize: 13, marginBottom: 10, display: 'block' }}>分类统计</Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {categoryData.map(cat => (
              <div key={cat.value}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 12 }}>{cat.emoji} {cat.label}</Text>
                  <Text strong style={{ fontSize: 12, color: cat.color }}>
                    {formatCost(cat.amount)}
                    {total > 0 && (
                      <span style={{ color: '#999', fontWeight: 400, marginLeft: 4 }}>
                        {Math.round(cat.amount / total * 100)}%
                      </span>
                    )}
                  </Text>
                </div>
                <div style={{
                  height: 8, borderRadius: 4,
                  background: 'rgba(0,0,0,0.04)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${maxAmount > 0 ? (cat.amount / maxAmount) * 100 : 0}%`,
                    borderRadius: 4,
                    background: cat.color,
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
          <Text strong style={{ fontSize: 13, marginBottom: 8, display: 'block' }}>地点明细</Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {spotCosts.map((s, i) => {
              const catInfo = COST_CATEGORIES.find(c => c.value === (s.category ?? 'other'))
              return (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', borderRadius: 10,
                  background: 'rgba(0,0,0,0.02)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 14 }}>{catInfo?.emoji ?? '💰'}</span>
                    <div style={{ minWidth: 0 }}>
                      <Text style={{ fontSize: 12, display: 'block' }} ellipsis>{s.name}</Text>
                      <Text type="secondary" style={{ fontSize: 10 }}>{s.date}</Text>
                    </div>
                  </div>
                  <Text strong style={{ fontSize: 13, color: '#d48806', flexShrink: 0 }}>
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
