import { Typography, Image } from 'antd'
import { EnvironmentOutlined, ClockCircleOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import type { TripSpot } from '@/shared/db'
import { useDb } from '@/shared/db/context'
import { groupSpotsByDate, formatCost, getTransportEmoji, getTransportLabel, getCostCategoryEmoji, T } from '../utils'
import { colors, gradients, shadows } from '@/shared/theme'

const { Text, Paragraph } = Typography

interface Props {
  spots: TripSpot[]
  tripStartDate: string
  onEditSpot: (spot: TripSpot) => void
  onDataChanged?: () => void
}

export default function SpotTimeline({ spots, tripStartDate, onEditSpot, onDataChanged }: Props) {
  const grouped = groupSpotsByDate(spots)
  const db = useDb()

  if (spots.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.2 }}>📍</div>
        <Text type="secondary" style={{ fontSize: 13 }}>暂无打卡点，点击上方按钮添加</Text>
      </div>
    )
  }

  const startMs = new Date(tripStartDate + 'T00:00:00').getTime()
  const dayNum = (date: string) => Math.floor((new Date(date + 'T00:00:00').getTime() - startMs) / 86_400_000) + 1

  const handleReorder = async (spot: TripSpot, direction: 'up' | 'down') => {
    const daySpots = [...spots]
      .filter(s => s.date === spot.date)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const idx = daySpots.findIndex(s => s.id === spot.id)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= daySpots.length) return
    const other = daySpots[swapIdx]!
    await db.tripSpots.update(spot.id, { sortOrder: other.sortOrder, updatedAt: Date.now() })
    await db.tripSpots.update(other.id, { sortOrder: spot.sortOrder, updatedAt: Date.now() })
    onDataChanged?.()
  }

  return (
    <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {[...grouped.entries()].map(([date, daySpots]) => (
        <div key={date}>
          {/* Day header */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 16px',
            borderRadius: 20,
            background: gradients.primaryLight,
            border: `1px solid rgba(245,114,45,0.08)`,
            marginBottom: 14,
          }}>
            <ClockCircleOutlined style={{ color: colors.primary, fontSize: 12 }} />
            <Text strong style={{ fontSize: 13, color: colors.primary }}>
              Day {dayNum(date)}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textTertiary }}>{date}</Text>
          </div>

          <div style={{ position: 'relative', paddingLeft: 22 }}>
            {/* Gradient vertical line */}
            <div style={{
              position: 'absolute',
              left: 8, top: 10,
              bottom: daySpots.length > 1 ? 10 : 0,
              width: 2,
              background: daySpots.length > 1
                ? `linear-gradient(${colors.primary}50, ${colors.primary}10)`
                : 'transparent',
              borderRadius: 1,
            }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {daySpots.map((spot, spotIdx) => (
                <div key={spot.id}>
                  {/* Transport connector */}
                  {spotIdx > 0 && daySpots[spotIdx]!.transport && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '4px 0 4px 4px',
                    }}>
                      <span style={{
                        fontSize: 11, padding: '2px 10px', borderRadius: 10,
                        background: colors.bg,
                        color: colors.textTertiary, fontWeight: 500,
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        border: `1px solid ${colors.borderLight}`,
                      }}>
                        {getTransportEmoji(spot.transport)} {getTransportLabel(spot.transport)}
                      </span>
                      <div style={{
                        flex: 1, height: 1,
                        background: `linear-gradient(90deg, ${colors.border}, transparent)`,
                      }} />
                    </div>
                  )}

                  <div style={{ position: 'relative' }}>
                    {/* Timeline dot */}
                    <div style={{
                      position: 'absolute', left: -19, top: 16,
                      width: 12, height: 12, borderRadius: '50%',
                      background: gradients.primary,
                      border: '2.5px solid #fff',
                      boxShadow: `0 0 0 3px ${colors.primary}20, ${shadows.sm}`,
                      zIndex: 1,
                    }} />

                    {/* Spot card */}
                    <div
                      className="card-hover"
                      onClick={() => onEditSpot(spot)}
                      style={{
                        background: '#fff',
                        border: `1px solid ${colors.borderLight}`,
                        borderRadius: 14,
                        padding: '12px 14px',
                        cursor: 'pointer',
                        boxShadow: shadows.card,
                      }}
                    >
                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <EnvironmentOutlined style={{ color: colors.primary, fontSize: 14 }} />
                        <Text strong style={{ fontSize: 14, flex: 1 }}>{spot.name}</Text>
                        {daySpots.length > 1 && onDataChanged && (
                          <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
                            {spotIdx > 0 && (
                              <div
                                onClick={() => handleReorder(spot, 'up')}
                                style={{
                                  width: 24, height: 24, borderRadius: 6,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer', color: colors.textTertiary, fontSize: 10,
                                  background: colors.bg,
                                  border: `1px solid ${colors.borderLight}`,
                                  transition: 'all 0.15s',
                                }}
                              >
                                <ArrowUpOutlined />
                              </div>
                            )}
                            {spotIdx < daySpots.length - 1 && (
                              <div
                                onClick={() => handleReorder(spot, 'down')}
                                style={{
                                  width: 24, height: 24, borderRadius: 6,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer', color: colors.textTertiary, fontSize: 10,
                                  background: colors.bg,
                                  border: `1px solid ${colors.borderLight}`,
                                  transition: 'all 0.15s',
                                }}
                              >
                                <ArrowDownOutlined />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Tags */}
                      <div style={{
                        display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 20,
                        marginBottom: spot.photos.length > 0 || spot.note || spot.address ? 6 : 0,
                      }}>
                        {spot.transport && spotIdx === 0 && (
                          <span style={{
                            fontSize: 11, padding: '2px 10px', borderRadius: 12,
                            background: T.gradientSubtle,
                            color: colors.primary, fontWeight: 500,
                          }}>
                            {getTransportEmoji(spot.transport)} {getTransportLabel(spot.transport)}
                          </span>
                        )}
                        {spot.cost != null && spot.cost > 0 && (
                          <span style={{
                            fontSize: 11, padding: '2px 10px', borderRadius: 12,
                            background: colors.warningBg,
                            color: colors.gold, fontWeight: 500,
                          }}>
                            {getCostCategoryEmoji(spot.costCategory)} {formatCost(spot.cost)}
                          </span>
                        )}
                      </div>

                      {/* Address */}
                      {spot.address && (
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', paddingLeft: 20, lineHeight: 1.5 }} ellipsis>
                          {spot.address}
                        </Text>
                      )}

                      {/* Note */}
                      {spot.note && (
                        <div style={{ marginTop: 6, paddingLeft: 20 }}>
                          <Paragraph
                            type="secondary"
                            style={{
                              fontSize: 12, marginBottom: 0, fontStyle: 'italic',
                              padding: '8px 12px',
                              background: colors.bg,
                              borderRadius: 10,
                              borderLeft: `2px solid ${colors.primary}30`,
                            }}
                            ellipsis={{ rows: 2 }}
                          >
                            {spot.note}
                          </Paragraph>
                        </div>
                      )}

                      {/* Photos — larger thumbnails */}
                      {spot.photos.length > 0 && (
                        <div style={{ marginTop: 8, paddingLeft: 20, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <Image.PreviewGroup>
                            {spot.photos.map((photo, i) => (
                              <div key={i} style={{
                                width: 76, height: 76, borderRadius: 12,
                                overflow: 'hidden',
                                boxShadow: shadows.sm,
                              }}>
                                <Image
                                  src={photo}
                                  width={76}
                                  height={76}
                                  style={{ objectFit: 'cover' }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            ))}
                          </Image.PreviewGroup>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
