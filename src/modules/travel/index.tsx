import { useState, useMemo } from 'react'
import { Button, Space, Select, Typography, Grid, Empty, Modal, message } from 'antd'
import { PlusOutlined, GlobalOutlined, DownloadOutlined } from '@ant-design/icons'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDb } from '@/shared/db/context'
import { useDataChanged } from '@/shared/sync/useDataChanged'
import type { Trip } from '@/shared/db'
import TripCard from './components/TripCard'
import TripForm from './components/TripForm'
import TripDetail from './components/TripDetail'
import FootprintMap from './components/FootprintMap'
import TravelStats from './components/TravelStats'
import TripMap from './components/TripMap'
import { exportTravelCSV } from './utils'

const { Text } = Typography
const { useBreakpoint } = Grid

export default function Travel() {
  const db = useDb()
  const notifyChanged = useDataChanged()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const [formOpen, setFormOpen] = useState(false)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null)
  const [showFootprint, setShowFootprint] = useState(false)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [yearFilter, setYearFilter] = useState<string | null>(null)
  const [routeTripId, setRouteTripId] = useState<number | null>(null)

  const trips = useLiveQuery(() => db.trips.orderBy('startDate').reverse().toArray(), [db]) ?? []
  const allSpots = useLiveQuery(() => db.tripSpots.toArray(), [db]) ?? []

  // 筛选
  const filteredTrips = useMemo(() => {
    let result = trips
    if (tagFilter) {
      result = result.filter((t) => t.tags.includes(tagFilter))
    }
    if (yearFilter) {
      result = result.filter((t) => t.startDate.startsWith(yearFilter))
    }
    return result
  }, [trips, tagFilter, yearFilter])

  // 提取所有标签和年份
  const allTags = useMemo(() => [...new Set(trips.flatMap((t) => t.tags))].sort(), [trips])
  const allYears = useMemo(() => {
    const years = [...new Set(trips.map((t) => t.startDate.slice(0, 4)))]
    return years.sort().reverse()
  }, [trips])

  const selectedTrip = trips.find((t) => t.id === selectedTripId) ?? null
  const selectedSpots = useMemo(
    () => (selectedTripId ? allSpots.filter((s) => s.tripId === selectedTripId) : []),
    [allSpots, selectedTripId],
  )

  const handleExport = () => {
    const csv = exportTravelCSV(trips, allSpots)
    const bom = '\uFEFF'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `旅行记录_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    message.success('导出成功')
  }

  const renderContent = () => {
    // 足迹地图视图
    if (showFootprint) {
      return (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Button type="text" onClick={() => setShowFootprint(false)}>
              ← 返回
            </Button>
            <Text strong style={{ fontSize: 16 }}>我的足迹地图</Text>
            <div style={{ width: 60 }} />
          </div>
          <FootprintMap trips={trips} spots={allSpots} height={isMobile ? 400 : 520} />
          <Text type="secondary" style={{ textAlign: 'center', display: 'block' }}>
            共 {allSpots.filter((s) => s.lat && s.lng).length} 个坐标点
          </Text>
        </Space>
      )
    }

    // 旅行详情视图
    if (selectedTrip) {
      return (
        <TripDetail
          trip={selectedTrip}
          spots={selectedSpots}
          onBack={() => setSelectedTripId(null)}
          onEdit={() => { setEditingTrip(selectedTrip); setFormOpen(true) }}
          onDeleted={() => setSelectedTripId(null)}
          onDataChanged={notifyChanged}
        />
      )
    }

    // 列表视图
    return (
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* 顶部操作栏 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <Space>
            <Button icon={<GlobalOutlined />} onClick={() => setShowFootprint(true)}>
              足迹地图
            </Button>
            {trips.length > 0 && (
              <Button icon={<DownloadOutlined />} onClick={handleExport} size={isMobile ? 'small' : 'middle'}>
                {!isMobile && '导出'}
              </Button>
            )}
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingTrip(null); setFormOpen(true) }}>
            新建旅行
          </Button>
        </div>

        {/* 统计 */}
        <TravelStats trips={trips} spots={allSpots} />

        {/* 筛选 */}
        {trips.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {allTags.length > 0 && (
              <Select
                placeholder="标签筛选"
                allowClear
                size="small"
                style={{ minWidth: 100 }}
                value={tagFilter}
                onChange={setTagFilter}
                options={allTags.map((t) => ({ label: t, value: t }))}
              />
            )}
            {allYears.length > 1 && (
              <Select
                placeholder="年份"
                allowClear
                size="small"
                style={{ minWidth: 80 }}
                value={yearFilter}
                onChange={setYearFilter}
                options={allYears.map((y) => ({ label: y, value: y }))}
              />
            )}
            {(tagFilter || yearFilter) && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {filteredTrips.length} / {trips.length} 次旅行
              </Text>
            )}
          </div>
        )}

        {/* 旅行卡片列表 */}
        {filteredTrips.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {filteredTrips.map((trip) => {
              const tripSpots = allSpots.filter((s) => s.tripId === trip.id)
              const hasCoords = tripSpots.some((s) => s.lat != null && s.lng != null) ||
                (trip.departureLat != null && trip.departureLng != null)
              return (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onClick={() => setSelectedTripId(trip.id)}
                  hasCoords={hasCoords}
                  onPlayRoute={() => setRouteTripId(trip.id)}
                />
              )
            })}
          </div>
        ) : trips.length > 0 ? (
          <Empty description="没有匹配的旅行" />
        ) : (
          <Empty description="还没有旅行记录，点击右上角开始记录第一次旅行吧" style={{ padding: 60 }} />
        )}
      </Space>
    )
  }

  const routeTrip = routeTripId ? trips.find((t) => t.id === routeTripId) ?? null : null
  const routeSpots = routeTripId ? allSpots.filter((s) => s.tripId === routeTripId) : []

  return (
    <>
      {renderContent()}
      <TripForm
        open={formOpen}
        trip={editingTrip}
        onClose={() => setFormOpen(false)}
        onSaved={notifyChanged}
      />
      <Modal
        title={routeTrip ? `${routeTrip.title} — 路线地图` : '路线地图'}
        open={routeTripId !== null}
        onCancel={() => setRouteTripId(null)}
        footer={null}
        width={isMobile ? '95vw' : 720}
        styles={{ body: { padding: '12px 0' } }}
      >
        {routeTrip && (
          <TripMap trip={routeTrip} spots={routeSpots} height={isMobile ? 350 : 450} />
        )}
      </Modal>
    </>
  )
}
