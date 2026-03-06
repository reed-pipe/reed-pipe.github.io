import { Timeline, Typography, Space, Image, Tag, theme } from 'antd'
import { EnvironmentOutlined, DollarOutlined, CameraOutlined } from '@ant-design/icons'
import type { TripSpot } from '@/shared/db'
import { groupSpotsByDate, formatCost, getTransportEmoji, getTransportLabel } from '../utils'

const { Text, Paragraph } = Typography

interface Props {
  spots: TripSpot[]
  tripStartDate: string
  onEditSpot: (spot: TripSpot) => void
}

export default function SpotTimeline({ spots, tripStartDate, onEditSpot }: Props) {
  const { token: { colorPrimary, colorTextSecondary } } = theme.useToken()
  const grouped = groupSpotsByDate(spots)

  if (spots.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <Text type="secondary">暂无打卡点，点击上方按钮添加</Text>
      </div>
    )
  }

  // 计算 Day N
  const startMs = new Date(tripStartDate + 'T00:00:00').getTime()
  const dayNum = (date: string) => Math.floor((new Date(date + 'T00:00:00').getTime() - startMs) / 86_400_000) + 1

  const items = [...grouped.entries()].map(([date, daySpots]) => ({
    color: colorPrimary,
    children: (
      <div>
        <Text strong style={{ fontSize: 14 }}>Day {dayNum(date)} — {date}</Text>
        <div style={{ marginTop: 8 }}>
          {daySpots.map((spot) => (
            <div
              key={spot.id}
              onClick={() => onEditSpot(spot)}
              style={{
                padding: '8px 12px',
                marginBottom: 8,
                borderRadius: 8,
                border: '1px solid #f0f0f0',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none' }}
            >
              <Space size={8} wrap>
                <EnvironmentOutlined style={{ color: colorPrimary }} />
                <Text strong>{spot.name}</Text>
                {spot.transport && (
                  <Tag style={{ margin: 0, fontSize: 11 }}>
                    {getTransportEmoji(spot.transport)} {getTransportLabel(spot.transport)}
                  </Tag>
                )}
                {spot.cost != null && spot.cost > 0 && (
                  <Tag icon={<DollarOutlined />} color="gold" style={{ margin: 0 }}>
                    {formatCost(spot.cost)}
                  </Tag>
                )}
              </Space>
              {spot.address && (
                <div style={{ marginTop: 2 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{spot.address}</Text>
                </div>
              )}
              {spot.note && (
                <Paragraph
                  type="secondary"
                  style={{ fontSize: 13, marginTop: 4, marginBottom: 0 }}
                  ellipsis={{ rows: 2 }}
                >
                  "{spot.note}"
                </Paragraph>
              )}
              {spot.photos.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <CameraOutlined style={{ color: colorTextSecondary, fontSize: 12, alignSelf: 'center' }} />
                  <Image.PreviewGroup>
                    {spot.photos.map((photo, i) => (
                      <Image
                        key={i}
                        src={photo}
                        width={48}
                        height={48}
                        style={{ objectFit: 'cover', borderRadius: 4 }}
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
    ),
  }))

  return <Timeline items={items} style={{ paddingTop: 8 }} />
}
