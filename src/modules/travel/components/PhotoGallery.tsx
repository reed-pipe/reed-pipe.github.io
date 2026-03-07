import { useMemo } from 'react'
import { Image, Typography, Modal, message, theme } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import type { TripSpot } from '@/shared/db'
import { useDb } from '@/shared/db/context'
import { groupSpotsByDate, T } from '../utils'

const { Text } = Typography

interface Props {
  spots: TripSpot[]
  tripStartDate?: string
  onDataChanged?: () => void
}

export default function PhotoGallery({ spots, tripStartDate, onDataChanged }: Props) {
  const db = useDb()
  const { token: { colorError } } = theme.useToken()

  const grouped = useMemo(() => {
    const byDate = groupSpotsByDate(spots)
    const result: { date: string; dayNum: number; photos: { photo: string; spotName: string; spotId: number; photoIdx: number }[] }[] = []
    const startMs = tripStartDate ? new Date(tripStartDate + 'T00:00:00').getTime() : 0

    for (const [date, daySpots] of byDate) {
      const photos = daySpots.flatMap(s =>
        s.photos.map((photo, idx) => ({ photo, spotName: s.name, spotId: s.id, photoIdx: idx })),
      )
      if (photos.length > 0) {
        const dayNum = tripStartDate
          ? Math.floor((new Date(date + 'T00:00:00').getTime() - startMs) / 86_400_000) + 1
          : 0
        result.push({ date, dayNum, photos })
      }
    }
    return result
  }, [spots, tripStartDate])

  const totalPhotos = grouped.reduce((n, g) => n + g.photos.length, 0)

  const handleDelete = (spotId: number, photoIdx: number, spotName: string) => {
    Modal.confirm({
      title: '删除照片',
      content: `确定删除「${spotName}」的这张照片？`,
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        const spot = await db.tripSpots.get(spotId)
        if (!spot) return
        const newPhotos = spot.photos.filter((_, i) => i !== photoIdx)
        await db.tripSpots.update(spotId, { photos: newPhotos })
        onDataChanged?.()
        message.success('已删除')
      },
    })
  }

  if (totalPhotos === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>📷</div>
        <Text type="secondary">暂无照片</Text>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {grouped.map(group => (
        <div key={group.date}>
          {/* Date header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 8,
          }}>
            {group.dayNum > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, color: T.primary,
                padding: '2px 10px', borderRadius: 10,
                background: T.primaryBg,
              }}>
                Day {group.dayNum}
              </span>
            )}
            <Text type="secondary" style={{ fontSize: 12 }}>{group.date}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{group.photos.length} 张</Text>
          </div>

          <Image.PreviewGroup>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
              gap: 6,
            }}>
              {group.photos.map(({ photo, spotName, spotId, photoIdx }, i) => (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    borderRadius: 12,
                    overflow: 'hidden',
                    aspectRatio: '1',
                  }}
                >
                  <Image
                    src={photo}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    padding: '16px 8px 6px',
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.55))',
                    pointerEvents: 'none',
                  }}>
                    <Text style={{ color: '#fff', fontSize: 11, display: 'block', lineHeight: 1.3 }} ellipsis>
                      {spotName}
                    </Text>
                  </div>
                  {onDataChanged && (
                    <div
                      onClick={(e) => { e.stopPropagation(); handleDelete(spotId, photoIdx, spotName) }}
                      style={{
                        position: 'absolute', top: 6, right: 6,
                        width: 26, height: 26, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.45)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', zIndex: 5,
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = colorError }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.45)' }}
                    >
                      <DeleteOutlined style={{ color: '#fff', fontSize: 12 }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Image.PreviewGroup>
        </div>
      ))}
    </div>
  )
}
