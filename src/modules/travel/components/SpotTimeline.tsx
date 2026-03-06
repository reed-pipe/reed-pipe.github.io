import { Typography, Image, theme } from 'antd'
import { EnvironmentOutlined, ClockCircleOutlined } from '@ant-design/icons'
import type { TripSpot } from '@/shared/db'
import { groupSpotsByDate, formatCost, getTransportEmoji, getTransportLabel } from '../utils'

const { Text, Paragraph } = Typography

interface Props {
  spots: TripSpot[]
  tripStartDate: string
  onEditSpot: (spot: TripSpot) => void
}

export default function SpotTimeline({ spots, tripStartDate, onEditSpot }: Props) {
  const { token: { colorPrimary, colorPrimaryBg, colorTextSecondary, colorBgLayout } } = theme.useToken()
  const grouped = groupSpotsByDate(spots)

  if (spots.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>📍</div>
        <Text type="secondary">暂无打卡点，点击上方按钮添加</Text>
      </div>
    )
  }

  const startMs = new Date(tripStartDate + 'T00:00:00').getTime()
  const dayNum = (date: string) => Math.floor((new Date(date + 'T00:00:00').getTime() - startMs) / 86_400_000) + 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[...grouped.entries()].map(([date, daySpots]) => (
        <div key={date}>
          {/* Day header */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 20,
            background: colorPrimaryBg,
            marginBottom: 10,
          }}>
            <ClockCircleOutlined style={{ color: colorPrimary, fontSize: 12 }} />
            <Text strong style={{ fontSize: 13, color: colorPrimary }}>
              Day {dayNum(date)}
            </Text>
            <Text style={{ fontSize: 12, color: colorTextSecondary }}>{date}</Text>
          </div>

          {/* Spots for this day */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 4 }}>
            {daySpots.map((spot) => (
              <div
                key={spot.id}
                onClick={() => onEditSpot(spot)}
                style={{
                  padding: 12,
                  borderRadius: 14,
                  background: colorBgLayout,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  border: '1px solid transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fff'
                  e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'
                  e.currentTarget.style.borderColor = `${colorPrimary}30`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = colorBgLayout
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.borderColor = 'transparent'
                }}
              >
                {/* Top row: name + tags */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <EnvironmentOutlined style={{ color: colorPrimary, fontSize: 14 }} />
                  <Text strong style={{ fontSize: 14 }}>{spot.name}</Text>
                  {spot.transport && (
                    <span style={{
                      fontSize: 11,
                      padding: '1px 8px',
                      borderRadius: 10,
                      background: `${colorPrimary}12`,
                      color: colorPrimary,
                    }}>
                      {getTransportEmoji(spot.transport)} {getTransportLabel(spot.transport)}
                    </span>
                  )}
                  {spot.cost != null && spot.cost > 0 && (
                    <span style={{
                      fontSize: 11,
                      padding: '1px 8px',
                      borderRadius: 10,
                      background: '#fff7e6',
                      color: '#d48806',
                    }}>
                      {formatCost(spot.cost)}
                    </span>
                  )}
                </div>

                {/* Address */}
                {spot.address && (
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4, paddingLeft: 22 }} ellipsis>
                    {spot.address}
                  </Text>
                )}

                {/* Note */}
                {spot.note && (
                  <Paragraph
                    type="secondary"
                    style={{ fontSize: 12, marginTop: 4, marginBottom: 0, paddingLeft: 22, fontStyle: 'italic' }}
                    ellipsis={{ rows: 2 }}
                  >
                    {spot.note}
                  </Paragraph>
                )}

                {/* Photos */}
                {spot.photos.length > 0 && (
                  <div style={{ marginTop: 8, paddingLeft: 22, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Image.PreviewGroup>
                      {spot.photos.map((photo, i) => (
                        <Image
                          key={i}
                          src={photo}
                          width={56}
                          height={56}
                          style={{ objectFit: 'cover', borderRadius: 8 }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ))}
                    </Image.PreviewGroup>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
