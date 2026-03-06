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
import { reverseGeocode } from '../geocode'
import type React from 'react'
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
  const { token: { colorPrimary, colorPrimaryBg, colorTextSecondary } } = theme.useToken()

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
    if (location) {
      message.success('已获取当前位置')
    } else {
      message.warning('无法获取位置，请手动搜索')
    }

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

  // Info chips data
  const infoChips = [
    trip.departureName && { icon: '🏠', text: `${trip.departureName} →` },
    { icon: <EnvironmentOutlined />, text: trip.destination },
    { icon: <CalendarOutlined />, text: `${formatDateRange(trip.startDate, trip.endDate)} · ${days}天` },
    (trip.totalCost != null && trip.totalCost > 0) && {
      icon: <DollarOutlined />,
      text: `${formatCost(trip.totalCost)}${spotCostTotal > 0 ? ` (地点 ${formatCost(spotCostTotal)})` : ''}`,
    },
  ].filter(Boolean) as { icon: React.ReactNode; text: string }[]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} style={{ padding: '4px 8px' }}>
          返回
        </Button>
        <Space size={6}>
          <Button type="text" icon={<EditOutlined />} onClick={onEdit} style={{ color: colorPrimary }} />
          <Button type="text" icon={<DeleteOutlined />} onClick={handleDelete} danger />
        </Space>
      </div>

      {/* Cover photo */}
      {trip.coverPhoto && (
        <div style={{ borderRadius: 16, overflow: 'hidden', maxHeight: 200, marginTop: -6 }}>
          <img src={trip.coverPhoto} alt={trip.title} style={{ width: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}

      {/* Title + info */}
      <div>
        <Title level={4} style={{ marginBottom: 8, fontSize: 18 }}>{trip.title}</Title>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {infoChips.map((chip, i) => (
            <span
              key={i}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 10px',
                borderRadius: 20,
                background: colorPrimaryBg,
                fontSize: 12,
                color: colorTextSecondary,
                lineHeight: '18px',
              }}
            >
              <span style={{ fontSize: 12 }}>{chip.icon}</span> {chip.text}
            </span>
          ))}
        </div>
        {(trip.tags.length > 0 || (trip.rating != null && trip.rating > 0)) && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {trip.tags.map((tag) => (
              <Tag
                key={tag}
                style={{
                  margin: 0,
                  borderRadius: 12,
                  border: 'none',
                  background: `${colorPrimary}10`,
                  color: colorPrimary,
                  fontSize: 12,
                }}
              >
                {tag}
              </Tag>
            ))}
            {trip.rating != null && trip.rating > 0 && (
              <Rate disabled value={trip.rating} style={{ fontSize: 13 }} />
            )}
          </div>
        )}
      </div>

      {/* Spots section */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 0 2px',
        borderTop: '1px solid rgba(0,0,0,0.05)',
      }}>
        <Text strong style={{ fontSize: 15 }}>打卡点 ({spots.length})</Text>
        <Space size={6}>
          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 12px',
              fontSize: 13,
              borderRadius: 20,
              background: colorPrimary,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            <CameraOutlined style={{ fontSize: 13 }} />
            打卡
            <input
              type="file"
              accept="image/*"
              onChange={handleQuickCapture}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 1 }}
            />
          </div>
          <Button
            size="small"
            icon={<PlusOutlined />}
            shape="round"
            onClick={() => { setEditingSpot(null); setQuickData(null); setSpotFormOpen(true) }}
          >
            添加
          </Button>
        </Space>
      </div>

      <Tabs
        defaultActiveKey="timeline"
        size="small"
        style={{ marginTop: -8 }}
        items={[
          {
            key: 'timeline',
            label: '时间线',
            children: (
              <SpotTimeline
                spots={spots}
                tripStartDate={trip.startDate}
                onEditSpot={handleEditSpot}
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
            label: `照片${spots.reduce((s, sp) => s + sp.photos.length, 0) > 0 ? ` (${spots.reduce((s, sp) => s + sp.photos.length, 0)})` : ''}`,
            children: <PhotoGallery spots={spots} onDataChanged={onDataChanged} />,
          },
        ]}
      />

      {/* Summary */}
      {trip.summary && (
        <div style={{
          padding: '12px 14px',
          background: colorPrimaryBg,
          borderRadius: 14,
          borderLeft: `3px solid ${colorPrimary}`,
        }}>
          <Text style={{ fontSize: 11, color: colorTextSecondary, display: 'block', marginBottom: 4 }}>旅行感想</Text>
          <Paragraph style={{ marginBottom: 0, fontSize: 13 }}>{trip.summary}</Paragraph>
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
    </div>
  )
}
