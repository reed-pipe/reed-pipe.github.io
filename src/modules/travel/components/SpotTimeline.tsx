import { Typography, Image, theme } from 'antd'
import { EnvironmentOutlined, ClockCircleOutlined } from '@ant-design/icons'
import type { TripSpot } from '@/shared/db'
import { groupSpotsByDate, formatCost, getTransportEmoji, getTransportLabel, T } from '../utils'

const { Text, Paragraph } = Typography

interface Props {
  spots: TripSpot[]
  tripStartDate: string
  onEditSpot: (spot: TripSpot) => void
}

export default function SpotTimeline({ spots, tripStartDate, onEditSpot }: Props) {
  const { token: { colorTextSecondary } } = theme.useToken()
  const grouped = groupSpotsByDate(spots)

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {[...grouped.entries()].map(([date, daySpots]) => (
        <div key={date}>
          {/* Day header — glass chip */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 16px',
            borderRadius: 20,
            ...T.glassButton,
            background: T.gradientLight,
            border: `1px solid ${T.primary}12`,
            marginBottom: 14,
            boxShadow: `0 2px 8px ${T.shadowLight}, inset 0 1px 0 rgba(255,255,255,0.7)`,
          }}>
            <ClockCircleOutlined style={{ color: T.primary, fontSize: 12 }} />
            <Text strong style={{ fontSize: 13, color: T.primary }}>
              Day {dayNum(date)}
            </Text>
            <Text style={{ fontSize: 12, color: colorTextSecondary }}>{date}</Text>
          </div>

          {/* Timeline */}
          <div style={{ position: 'relative', paddingLeft: 22 }}>
            {/* Gradient vertical line */}
            <div style={{
              position: 'absolute',
              left: 8,
              top: 10,
              bottom: daySpots.length > 1 ? 10 : 0,
              width: 2,
              background: daySpots.length > 1
                ? `linear-gradient(${T.primary}50, ${T.primary}10)`
                : 'transparent',
              borderRadius: 1,
            }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {daySpots.map((spot) => (
                <div key={spot.id} style={{ position: 'relative' }}>
                  {/* Glowing timeline dot */}
                  <div style={{
                    position: 'absolute',
                    left: -19,
                    top: 16,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: T.gradient,
                    border: '2.5px solid #fff',
                    boxShadow: `0 0 0 3px ${T.primary}20, 0 2px 4px ${T.shadow}`,
                    zIndex: 1,
                  }} />

                  {/* Glass spot card */}
                  <div
                    onClick={() => onEditSpot(spot)}
                    style={{
                      ...T.glassCard,
                      padding: '13px 15px',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => Object.assign(e.currentTarget.style, T.glassCardHover)}
                    onMouseLeave={(e) => Object.assign(e.currentTarget.style, {
                      boxShadow: T.glassCard.boxShadow,
                      transform: 'translateY(0)',
                    })}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <EnvironmentOutlined style={{ color: T.primary, fontSize: 14 }} />
                      <Text strong style={{ fontSize: 14 }}>{spot.name}</Text>
                    </div>

                    {/* Tags */}
                    <div style={{
                      display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 20,
                      marginBottom: spot.photos.length > 0 || spot.note || spot.address ? 6 : 0,
                    }}>
                      {spot.transport && (
                        <span style={{
                          fontSize: 11, padding: '2px 10px', borderRadius: 12,
                          background: T.gradientSubtle,
                          color: T.primary, fontWeight: 500,
                          boxShadow: `inset 0 -1px 0 ${T.primary}08`,
                        }}>
                          {getTransportEmoji(spot.transport)} {getTransportLabel(spot.transport)}
                        </span>
                      )}
                      {spot.cost != null && spot.cost > 0 && (
                        <span style={{
                          fontSize: 11, padding: '2px 10px', borderRadius: 12,
                          background: 'linear-gradient(135deg, #fff7e6, #fffbe6)',
                          color: '#d48806', fontWeight: 500,
                          boxShadow: 'inset 0 -1px 0 rgba(212,136,6,0.08)',
                        }}>
                          {formatCost(spot.cost)}
                        </span>
                      )}
                    </div>

                    {/* Address */}
                    {spot.address && (
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', paddingLeft: 20, lineHeight: 1.5 }} ellipsis>
                        {spot.address}
                      </Text>
                    )}

                    {/* Note — glass inset */}
                    {spot.note && (
                      <div style={{ marginTop: 6, paddingLeft: 20 }}>
                        <Paragraph
                          type="secondary"
                          style={{
                            fontSize: 12, marginBottom: 0, fontStyle: 'italic',
                            padding: '8px 12px',
                            background: 'rgba(0,0,0,0.02)',
                            borderRadius: 10,
                            borderLeft: `2px solid ${T.primary}30`,
                            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.03)',
                          }}
                          ellipsis={{ rows: 2 }}
                        >
                          {spot.note}
                        </Paragraph>
                      </div>
                    )}

                    {/* Photos */}
                    {spot.photos.length > 0 && (
                      <div style={{ marginTop: 8, paddingLeft: 20, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Image.PreviewGroup>
                          {spot.photos.map((photo, i) => (
                            <div key={i} style={{
                              width: 64, height: 64, borderRadius: 12,
                              overflow: 'hidden',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.3)',
                            }}>
                              <Image
                                src={photo}
                                width={64}
                                height={64}
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
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
