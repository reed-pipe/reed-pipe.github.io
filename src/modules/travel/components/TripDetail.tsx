import { useState, useCallback } from 'react'
import { Button, Space, Tabs, Typography, Tag, Rate, Modal, message, theme } from 'antd'
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  DollarOutlined,
  CameraOutlined,
} from '@ant-design/icons'
import type { Trip, TripSpot } from '@/shared/db'
import { useDb } from '@/shared/db/context'
import { formatDateRange, tripDays, formatCost, compressImage } from '../utils'
import SpotTimeline from './SpotTimeline'
import SpotForm, { type SpotInitialData } from './SpotForm'
import TripMap from './TripMap'
import PhotoGallery from './PhotoGallery'

const { Text, Paragraph, Title } = Typography

interface Props {
  trip: Trip
  spots: TripSpot[]
  onBack: () => void
  onEdit: () => void
  onDeleted: () => void
  onDataChanged: () => void
}

export default function TripDetail({ trip, spots, onBack, onEdit, onDeleted, onDataChanged }: Props) {
  const [spotFormOpen, setSpotFormOpen] = useState(false)
  const [editingSpot, setEditingSpot] = useState<TripSpot | null>(null)
  const [quickData, setQuickData] = useState<SpotInitialData | null>(null)
  const db = useDb()
  const { token: { colorTextSecondary, colorPrimary } } = theme.useToken()

  const days = tripDays(trip.startDate, trip.endDate)
  const spotCostTotal = spots.reduce((s, sp) => s + (sp.cost ?? 0), 0)
  const nextSortOrder = spots.length > 0 ? Math.max(...spots.map((s) => s.sortOrder)) + 1 : 0

  const handleDelete = () => {
    Modal.confirm({
      title: '删除旅行',
      content: `确定删除「${trip.title}」及其所有打卡点？此操作不可撤销。`,
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        await db.tripSpots.where('tripId').equals(trip.id).delete()
        await db.trips.delete(trip.id)
        onDataChanged()
        onDeleted()
        message.success('已删除')
      },
    })
  }

  const handleEditSpot = (spot: TripSpot) => {
    setEditingSpot(spot)
    setQuickData(null)
    setSpotFormOpen(true)
  }

  /** Get current GPS position */
  const getGeoLocation = useCallback((): Promise<{ lat: number; lng: number; address: string } | null> => {
    if (!navigator.geolocation) return Promise.resolve(null)
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords
          // Reverse geocode
          let address = ''
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh`,
              { headers: { 'User-Agent': 'PersonalAssistant/1.0' } },
            )
            const data = await res.json()
            address = data.display_name ?? ''
          } catch { /* ignore */ }
          resolve({ lat, lng, address })
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 },
      )
    })
  }, [])

  /** Quick check-in: handle file from native label→input */
  const handleQuickCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    message.loading({ content: '正在获取位置...', key: 'quickCheckin', duration: 0 })

    const [compressed, location] = await Promise.all([
      compressImage(file, 800, 0.7),
      getGeoLocation(),
    ])

    message.destroy('quickCheckin')
    if (location) {
      message.success('已获取当前位置')
    } else {
      message.warning('无法获取位置，请手动搜索')
    }

    const today = new Date().toISOString().slice(0, 10)
    const date = today < trip.startDate ? trip.startDate : today > trip.endDate ? trip.endDate : today

    setQuickData({
      photos: [compressed],
      location: location ?? undefined,
      date,
    })
    setEditingSpot(null)
    setSpotFormOpen(true)
  }, [getGeoLocation, trip.startDate, trip.endDate])

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {/* 顶部 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>
          返回
        </Button>
        <Space>
          <Button icon={<EditOutlined />} onClick={onEdit}>编辑</Button>
          <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>删除</Button>
        </Space>
      </div>

      {/* 封面 + 基本信息 */}
      {trip.coverPhoto && (
        <div style={{ borderRadius: 8, overflow: 'hidden', maxHeight: 220 }}>
          <img src={trip.coverPhoto} alt={trip.title} style={{ width: '100%', objectFit: 'cover' }} />
        </div>
      )}

      <div>
        <Title level={4} style={{ marginBottom: 4 }}>{trip.title}</Title>
        <Space wrap size={12}>
          {trip.departureName && (
            <Text type="secondary">
              🏠 {trip.departureName} →
            </Text>
          )}
          <Text type="secondary">
            <EnvironmentOutlined /> {trip.destination}
          </Text>
          <Text type="secondary">
            <CalendarOutlined /> {formatDateRange(trip.startDate, trip.endDate)} · {days}天
          </Text>
          {(trip.totalCost != null && trip.totalCost > 0) && (
            <Text type="secondary">
              <DollarOutlined /> {formatCost(trip.totalCost)}
              {spotCostTotal > 0 && <span style={{ fontSize: 12, color: colorTextSecondary }}> (地点合计 {formatCost(spotCostTotal)})</span>}
            </Text>
          )}
        </Space>
        <div style={{ marginTop: 6 }}>
          {trip.tags.map((tag) => (
            <Tag key={tag} style={{ marginBottom: 4 }}>{tag}</Tag>
          ))}
          {trip.rating != null && trip.rating > 0 && (
            <Rate disabled value={trip.rating} style={{ fontSize: 14, marginLeft: 8 }} />
          )}
        </div>
      </div>

      {/* 打卡点管理 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text strong style={{ fontSize: 15 }}>打卡点 ({spots.length})</Text>
        <Space size={8}>
          {/* Native label→input: works in iOS PWA standalone mode */}
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 8px',
              height: 24,
              fontSize: 14,
              borderRadius: 6,
              background: colorPrimary,
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 400,
            }}
          >
            <CameraOutlined />
            快速打卡
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleQuickCapture}
              style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}
            />
          </label>
          <Button size="small" icon={<PlusOutlined />} onClick={() => { setEditingSpot(null); setQuickData(null); setSpotFormOpen(true) }}>
            添加
          </Button>
        </Space>
      </div>
      <Tabs
        defaultActiveKey="timeline"
        items={[
          {
            key: 'timeline',
            label: '时间线',
            children: (
              <SpotTimeline
                spots={spots}
                tripStartDate={trip.startDate}
                onEditSpot={(spot) => {
                  // 长按或右键可删除——这里先用编辑
                  handleEditSpot(spot)
                }}
              />
            ),
          },
          {
            key: 'map',
            label: '地图',
            children: <TripMap trip={trip} spots={spots} />,
          },
          {
            key: 'photos',
            label: '照片',
            children: <PhotoGallery spots={spots} />,
          },
        ]}
      />

      {/* 旅行感想 */}
      {trip.summary && (
        <div style={{ padding: '12px 16px', background: '#fafafa', borderRadius: 8 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>旅行感想</Text>
          <Paragraph style={{ marginBottom: 0 }}>{trip.summary}</Paragraph>
        </div>
      )}

      <SpotForm
        open={spotFormOpen}
        tripId={trip.id}
        tripStartDate={trip.startDate}
        tripEndDate={trip.endDate}
        spot={editingSpot}
        nextSortOrder={nextSortOrder}
        initialData={!editingSpot ? quickData : null}
        onClose={() => { setSpotFormOpen(false); setQuickData(null) }}
        onSaved={onDataChanged}
      />
    </Space>
  )
}
