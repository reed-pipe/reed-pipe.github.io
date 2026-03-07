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
  const { token: { colorTextSecondary, colorBgLayout } } = theme.useToken()
  const colorPrimary = T.primary
  const grouped = groupSpotsByDate(spots)

  if (spots.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.25 }}>📍</div>
        <Text type="secondary" style={{ fontSize: 13 }}>暂无打卡点，点击上方按钮添加</Text>
      </div>
    )
  }

  const startMs = new Date(tripStartDate + 'T00:00:00').getTime()
  const dayNum = (date: string) => Math.floor((new Date(date + 'T00:00:00').getTime() - startMs) / 86_400_000) + 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {[...grouped.entries()].map(([date, daySpots]) => (
        <div key={date}>
          {/* Day header */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 14px',
            borderRadius: 20,
            background: T.gradientLight,
            marginBottom: 12,
            boxShadow: `0 1px 4px ${T.shadowLight}`,
          }}>
            <ClockCircleOutlined style={{ color: colorPrimary, fontSize: 12 }} />
            <Text strong style={{ fontSize: 13, color: colorPrimary }}>
              Day {dayNum(date)}
            </Text>
            <Text style={{ fontSize: 12, color: colorTextSecondary }}>{date}</Text>
          </div>

          {/* Timeline with connecting line */}
          <div style={{ position: 'relative', paddingLeft: 20 }}>
            {/* Vertical line */}
            <div style={{
              position: 'absolute',
              left: 7,
              top: 8,
              bottom: daySpots.length > 1 ? 8 : 0,
              width: 2,
              background: daySpots.length > 1 ? `linear-gradient(${T.primary}40, ${T.primary}10)` : 'transparent',
              borderRadius: 1,
            }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {daySpots.map((spot) => (
                <div key={spot.id} style={{ position: 'relative' }}>
                  {/* Timeline dot */}
                  <div style={{
                    position: 'absolute',
                    left: -17,
                    top: 14,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: colorPrimary,
                    border: '2px solid #fff',
                    boxShadow: `0 0 0 2px ${colorPrimary}30`,
                    zIndex: 1,
                  }} />

                  {/* Spot card */}
                  <div
                    onClick={() => onEditSpot(spot)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 14,
                      background: '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.25s ease',
                      border: '1px solid rgba(0,0,0,0.04)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = `0 4px 16px rgba(0,0,0,0.08), 0 0 0 1px ${T.primary}20`
                      e.currentTarget.style.transform = 'translateY(-1px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    {/* Header: spot name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <EnvironmentOutlined style={{ color: colorPrimary, fontSize: 14 }} />
                      <Text strong style={{ fontSize: 14 }}>{spot.name}</Text>
                    </div>

                    {/* Tags row */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 20, marginBottom: spot.photos.length > 0 || spot.note || spot.address ? 6 : 0 }}>
                      {spot.transport && (
                        <span style={{
                          fontSize: 11,
                          padding: '2px 10px',
                          borderRadius: 12,
                          background: T.gradientLight,
                          color: colorPrimary,
                          fontWeight: 500,
                        }}>
                          {getTransportEmoji(spot.transport)} {getTransportLabel(spot.transport)}
                        </span>
                      )}
                      {spot.cost != null && spot.cost > 0 && (
                        <span style={{
                          fontSize: 11,
                          padding: '2px 10px',
                          borderRadius: 12,
                          background: 'linear-gradient(135deg, #fff7e6, #fffbe6)',
                          color: '#d48806',
                          fontWeight: 500,
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

                    {/* Note */}
                    {spot.note && (
                      <div style={{
                        marginTop: 6,
                        paddingLeft: 20,
                      }}>
                        <Paragraph
                          type="secondary"
                          style={{
                            fontSize: 12,
                            marginBottom: 0,
                            fontStyle: 'italic',
                            padding: '6px 10px',
                            background: colorBgLayout,
                            borderRadius: 8,
                            borderLeft: `2px solid ${colorPrimary}30`,
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
                              width: 64,
                              height: 64,
                              borderRadius: 10,
                              overflow: 'hidden',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
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
