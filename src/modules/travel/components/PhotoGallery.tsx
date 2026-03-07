import { useMemo } from 'react'
import { Image, Typography, Modal, message, theme } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import type { TripSpot } from '@/shared/db'
import { useDb } from '@/shared/db/context'
import { groupSpotsByDate, T } from '../utils'
import { colors } from '@/shared/theme'

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
        <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.25 }}>📷</div>
        <Text type="secondary" style={{ fontSize: 13 }}>暂无照片</Text>
      </div>
    )
  }

  return (
    <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {grouped.map(group => (
        <div key={group.date}>
          {/* Date header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 10,
          }}>
            {group.dayNum > 0 && (
              <span style={{
                fontSize: 12, fontWeight: 700, color: '#fff',
                padding: '3px 12px', borderRadius: 10,
                background: T.gradient,
              }}>
                Day {group.dayNum}
              </span>
            )}
            <Text type="secondary" style={{ fontSize: 12 }}>{group.date}</Text>
            <div style={{
              width: 4, height: 4, borderRadius: '50%',
              background: colors.textTertiary,
            }} />
            <Text type="secondary" style={{ fontSize: 12 }}>{group.photos.length} 张</Text>
          </div>

          <Image.PreviewGroup>
            {/* Mixed layout: first photo large, rest smaller */}
            {group.photos.length >= 3 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {/* Hero photo — spans both columns */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <PhotoItem
                    photo={group.photos[0]!}
                    onDelete={onDataChanged ? handleDelete : undefined}
                    colorError={colorError}
                    height={200}
                  />
                </div>
                {group.photos.slice(1).map((p, i) => (
                  <PhotoItem
                    key={i}
                    photo={p}
                    onDelete={onDataChanged ? handleDelete : undefined}
                    colorError={colorError}
                    height={130}
                  />
                ))}
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: group.photos.length === 1 ? '1fr' : '1fr 1fr',
                gap: 6,
              }}>
                {group.photos.map((p, i) => (
                  <PhotoItem
                    key={i}
                    photo={p}
                    onDelete={onDataChanged ? handleDelete : undefined}
                    colorError={colorError}
                    height={group.photos.length === 1 ? 220 : 160}
                  />
                ))}
              </div>
            )}
          </Image.PreviewGroup>
        </div>
      ))}
    </div>
  )
}

function PhotoItem({ photo, onDelete, colorError, height }: {
  photo: { photo: string; spotName: string; spotId: number; photoIdx: number }
  onDelete?: (spotId: number, photoIdx: number, spotName: string) => void
  colorError: string
  height: number
}) {
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 14,
        overflow: 'hidden',
        height,
      }}
    >
      <Image
        src={photo.photo}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '20px 10px 8px',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.55))',
        pointerEvents: 'none',
      }}>
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: 500, display: 'block', lineHeight: 1.3 }} ellipsis>
          {photo.spotName}
        </Text>
      </div>
      {onDelete && (
        <div
          onClick={(e) => { e.stopPropagation(); onDelete(photo.spotId, photo.photoIdx, photo.spotName) }}
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 5,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = colorError }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.4)' }}
        >
          <DeleteOutlined style={{ color: '#fff', fontSize: 12 }} />
        </div>
      )}
    </div>
  )
}
