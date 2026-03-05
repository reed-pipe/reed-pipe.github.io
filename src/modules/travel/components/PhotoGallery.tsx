import { Image, Empty, Typography } from 'antd'
import type { TripSpot } from '@/shared/db'
import { sortSpots } from '../utils'

const { Text } = Typography

interface Props {
  spots: TripSpot[]
}

export default function PhotoGallery({ spots }: Props) {
  const sorted = sortSpots(spots)
  const allPhotos = sorted.flatMap((s) =>
    s.photos.map((photo) => ({ photo, spotName: s.name })),
  )

  if (allPhotos.length === 0) {
    return <Empty description="暂无照片" style={{ padding: 40 }} />
  }

  return (
    <Image.PreviewGroup>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 8,
        }}
      >
        {allPhotos.map(({ photo, spotName }, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <Image
              src={photo}
              style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6 }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '2px 6px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.5))',
                borderRadius: '0 0 6px 6px',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 11, display: 'block' }} ellipsis>
                {spotName}
              </Text>
            </div>
          </div>
        ))}
      </div>
    </Image.PreviewGroup>
  )
}
