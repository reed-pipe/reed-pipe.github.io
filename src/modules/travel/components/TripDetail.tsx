import { useState, useCallback } from 'react'
import { Button, Space, Tabs, Typography, Rate, Modal, message } from 'antd'
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
import { formatDateRange, tripDays, formatCost, compressImage, getTripStatusLabel, T } from '../utils'
import { reverseGeocode } from '../geocode'
import { colors, gradients, shadows } from '@/shared/theme'
import type React from 'react'
import SpotTimeline from './SpotTimeline'
import SpotForm, { type SpotInitialData } from './SpotForm'
import TripMap from './TripMap'
import PhotoGallery from './PhotoGallery'
import CostChart from './CostChart'
import ShareCard from './ShareCard'

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

  const days = tripDays(trip.startDate, trip.endDate)
  const spotCostTotal = spots.reduce((s, sp) => s + (sp.cost ?? 0), 0)
  const photoCount = spots.reduce((s, sp) => s + sp.photos.length, 0)
  const nextSortOrder = spots.length > 0 ? Math.max(...spots.map((s) => s.sortOrder)) + 1 : 0
  const statusLabel = getTripStatusLabel(trip)

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

  const getGeoLocation = useCallback((): Promise<{ lat: number; lng: number; address: string; name: string } | null> => {
    if (!navigator.geolocation) return Promise.resolve(null)
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords
          let address = ''
          let name = ''
          try {
            const result = await reverseGeocode(lat, lng)
            address = result?.address ?? ''
            name = result?.name ?? ''
          } catch { /* ignore */ }
          resolve({ lat, lng, address, name })
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 },
      )
    })
  }, [])

  const handleQuickCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    message.loading({ content: '正在获取位置...', key: 'quickCheckin', duration: 0 })
    const [compressed, location] = await Promise.all([
      compressImage(file, 800, 0.7),
      getGeoLocation(),
    ])
    message.destroy('quickCheckin')
    if (location) message.success('已获取当前位置')
    else message.warning('无法获取位置，请手动搜索')

    const today = new Date().toISOString().slice(0, 10)
    const date = today < trip.startDate ? trip.startDate : today > trip.endDate ? trip.endDate : today

    setQuickData({
      name: location?.name || undefined,
      photos: [compressed],
      location: location ? { lat: location.lat, lng: location.lng, address: location.address } : undefined,
      date,
    })
    setEditingSpot(null)
    setSpotFormOpen(true)
  }, [getGeoLocation, trip.startDate, trip.endDate])

  return (
    <div className="fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 0 8px',
      }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}
          style={{ padding: '4px 8px', fontWeight: 500, borderRadius: 10 }}
        >
          返回
        </Button>
        <Space size={4}>
          <ShareCard trip={trip} spots={spots} />
          <Button type="text" icon={<EditOutlined />} onClick={onEdit}
            style={{
              ...T.glassButton,
              color: colors.primary,
              background: colors.primaryBg,
              padding: '4px 10px', height: 'auto',
            }}
          />
          <Button type="text" icon={<DeleteOutlined />} onClick={handleDelete} danger
            style={{ borderRadius: 12, background: colors.dangerBg, padding: '4px 10px', height: 'auto' }}
          />
        </Space>
      </div>

      {/* Hero: cover or gradient */}
      {trip.coverPhoto ? (
        <div style={{
          position: 'relative', borderRadius: 20, overflow: 'hidden',
          maxHeight: 200, marginBottom: 14,
          boxShadow: shadows.md,
        }}>
          <img src={trip.coverPhoto} alt={trip.title} style={{ width: '100%', objectFit: 'cover', display: 'block' }} />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '48px 16px 14px',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.55))',
          }}>
            <Title level={4} style={{
              marginBottom: 2, color: '#fff', fontSize: 18,
              textShadow: '0 1px 6px rgba(0,0,0,0.3)',
              letterSpacing: '0.01em',
            }}>
              {trip.title}
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 12 }}>
              {trip.destination} · {formatDateRange(trip.startDate, trip.endDate)}
            </Text>
          </div>
          <div style={{
            position: 'absolute', top: 12, left: 12,
            padding: '3px 12px', borderRadius: 12,
            background: statusLabel.bg,
            color: statusLabel.color,
            fontSize: 11, fontWeight: 600,
            boxShadow: shadows.sm,
            backdropFilter: 'blur(8px)',
          }}>
            {statusLabel.text}
          </div>
        </div>
      ) : (
        <div style={{
          marginBottom: 14, padding: '22px 20px 18px',
          borderRadius: 20, overflow: 'hidden',
          background: gradients.hero,
          boxShadow: shadows.primary,
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', top: -20, right: -20,
            width: 80, height: 80, borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
          }} />
          <div style={{
            position: 'absolute', bottom: -10, left: 30,
            width: 50, height: 50, borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
          }} />
          <Title level={4} style={{
            marginBottom: 4, color: '#fff', fontSize: 18,
            textShadow: '0 1px 4px rgba(0,0,0,0.15)',
          }}>
            {trip.title}
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
            {trip.destination} · {formatDateRange(trip.startDate, trip.endDate)}
          </Text>
          <div style={{
            position: 'absolute', top: 12, right: 12,
            padding: '3px 12px', borderRadius: 12,
            background: 'rgba(255,255,255,0.25)',
            backdropFilter: 'blur(8px)',
            color: '#fff',
            fontSize: 11, fontWeight: 600,
          }}>
            {statusLabel.text}
          </div>
        </div>
      )}

      {/* Info chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {trip.departureName && (
          <InfoChip icon="🏠" text={`${trip.departureName} ->`} variant="default" />
        )}
        <InfoChip icon={<EnvironmentOutlined style={{ fontSize: 11 }} />} text={trip.destination} variant="primary" />
        <InfoChip icon={<CalendarOutlined style={{ fontSize: 11 }} />} text={`${days}天`} variant="default" />
        {(trip.totalCost != null && trip.totalCost > 0) && (
          <InfoChip
            icon={<DollarOutlined style={{ fontSize: 11 }} />}
            text={`${formatCost(trip.totalCost)}${spotCostTotal > 0 ? ` (地点${formatCost(spotCostTotal)})` : ''}`}
            variant="gold"
          />
        )}
      </div>

      {/* Tags + rating */}
      {(trip.tags.length > 0 || (trip.rating != null && trip.rating > 0)) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {trip.tags.map((tag) => (
            <span key={tag} style={{
              padding: '4px 14px', borderRadius: 14, fontSize: 12,
              background: T.gradientSubtle,
              color: colors.primary, fontWeight: 500,
            }}>
              {tag}
            </span>
          ))}
          {trip.rating != null && trip.rating > 0 && (
            <Rate disabled value={trip.rating} style={{ fontSize: 13 }} />
          )}
        </div>
      )}

      {/* Summary — moved above tabs for better visibility */}
      {trip.summary && (
        <div style={{
          padding: '12px 14px',
          borderRadius: 14,
          background: T.gradientLight,
          borderLeft: `3px solid ${colors.primary}`,
          marginBottom: 14,
        }}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4, fontWeight: 500 }}>
            旅行感想
          </Text>
          <Paragraph style={{ marginBottom: 0, fontSize: 13, lineHeight: 1.7, color: colors.text }}>{trip.summary}</Paragraph>
        </div>
      )}

      {/* Spot management bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 0 8px',
        borderTop: `1px solid ${colors.borderLight}`,
      }}>
        <Text strong style={{ fontSize: 15 }}>打卡点 ({spots.length})</Text>
        <Space size={6}>
          <div style={{
            position: 'relative',
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 16px', fontSize: 13, borderRadius: 20,
            background: gradients.primary,
            color: '#fff', cursor: 'pointer', fontWeight: 600,
            boxShadow: shadows.primary,
          }}>
            <CameraOutlined style={{ fontSize: 13 }} />
            打卡
            <input
              type="file" accept="image/*"
              onChange={handleQuickCapture}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 1 }}
            />
          </div>
          <Button
            size="small" icon={<PlusOutlined />} shape="round"
            onClick={() => { setEditingSpot(null); setQuickData(null); setSpotFormOpen(true) }}
            style={{ borderRadius: 20 }}
          >
            添加
          </Button>
        </Space>
      </div>

      <Tabs
        defaultActiveKey="timeline"
        size="small"
        items={[
          {
            key: 'timeline',
            label: '时间线',
            children: (
              <SpotTimeline
                spots={spots}
                tripStartDate={trip.startDate}
                onEditSpot={handleEditSpot}
                onDataChanged={onDataChanged}
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
            label: `照片${photoCount > 0 ? ` (${photoCount})` : ''}`,
            children: (
              <PhotoGallery
                spots={spots}
                tripStartDate={trip.startDate}
                onDataChanged={onDataChanged}
              />
            ),
          },
          {
            key: 'cost',
            label: '花费',
            children: <CostChart spots={spots} tripTotalCost={trip.totalCost} />,
          },
        ]}
      />

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
    </div>
  )
}

function InfoChip({ icon, text, variant }: {
  icon: React.ReactNode; text: string
  variant: 'primary' | 'default' | 'gold'
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      background: colors.primaryBg,
      color: colors.primary,
      fontWeight: 600,
    },
    default: {
      background: colors.bg,
      color: colors.textSecondary,
    },
    gold: {
      background: colors.warningBg,
      color: colors.gold,
    },
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '5px 14px', borderRadius: 20,
      fontSize: 12, lineHeight: '16px',
      border: `1px solid ${colors.borderLight}`,
      ...styles[variant],
    }}>
      {icon} {text}
    </span>
  )
}
