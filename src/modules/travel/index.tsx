import { useState, useMemo } from 'react'
import { Button, Space, Select, Segmented, Typography, Grid, message, theme } from 'antd'
import { PlusOutlined, DownloadOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import { useLiveQuery } from 'dexie-react-hooks'
import 'leaflet/dist/leaflet.css'
import { useDb } from '@/shared/db/context'
import { useDataChanged } from '@/shared/sync/useDataChanged'
import type { Trip } from '@/shared/db'
import TripForm from './components/TripForm'
import TripDetail from './components/TripDetail'
import FootprintMap from './components/FootprintMap'
import { exportTravelCSV, computeStats, formatCost, tripDays, formatDateRange } from './utils'
import { useMapProviderPreference, setMapProvider } from './mapConfig'

const { Text } = Typography
const { useBreakpoint } = Grid

const PANEL_WIDTH = 360

const glassPanel: React.CSSProperties = {
  background: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  border: '1px solid rgba(255,255,255,0.6)',
}

const glassButton: React.CSSProperties = {
  ...glassPanel,
  borderRadius: 10,
  padding: '4px 8px',
  height: 'auto',
}

export default function Travel() {
  const db = useDb()
  const notifyChanged = useDataChanged()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const { token: { colorPrimary } } = theme.useToken()

  const [formOpen, setFormOpen] = useState(false)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [yearFilter, setYearFilter] = useState<string | null>(null)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [sheetSnap, setSheetSnap] = useState<'peek' | 'half' | 'full'>('half')
  const mapPref = useMapProviderPreference()

  const trips = useLiveQuery(() => db.trips.orderBy('startDate').reverse().toArray(), [db]) ?? []
  const allSpots = useLiveQuery(() => db.tripSpots.toArray(), [db]) ?? []

  const filteredTrips = useMemo(() => {
    let result = trips
    if (tagFilter) result = result.filter(t => t.tags.includes(tagFilter))
    if (yearFilter) result = result.filter(t => t.startDate.startsWith(yearFilter))
    return result
  }, [trips, tagFilter, yearFilter])

  const allTags = useMemo(() => [...new Set(trips.flatMap(t => t.tags))].sort(), [trips])
  const allYears = useMemo(() => {
    const years = [...new Set(trips.map(t => t.startDate.slice(0, 4)))]
    return years.sort().reverse()
  }, [trips])

  const selectedTrip = trips.find(t => t.id === selectedTripId) ?? null
  const selectedSpots = useMemo(
    () => selectedTripId ? allSpots.filter(s => s.tripId === selectedTripId) : [],
    [allSpots, selectedTripId],
  )

  const stats = useMemo(() => computeStats(trips, allSpots), [trips, allSpots])
  const spotCount = allSpots.filter(s => s.lat && s.lng).length

  const handleExport = () => {
    const csv = exportTravelCSV(trips, allSpots)
    const bom = '\uFEFF'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `\u65C5\u884C\u8BB0\u5F55_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    message.success('\u5BFC\u51FA\u6210\u529F')
  }

  const handleSelectTrip = (tripId: number) => {
    setSelectedTripId(tripId)
    if (isMobile) setSheetSnap('full')
  }

  const handleBack = () => {
    setSelectedTripId(null)
    if (isMobile) setSheetSnap('half')
  }

  const panelHeader = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
      <Segmented
        size="small"
        options={[
          { label: '\u81EA\u52A8', value: 'auto' },
          { label: 'OSM', value: 'osm' },
          { label: '\u9AD8\u5FB7', value: 'amap' },
        ]}
        value={mapPref}
        onChange={v => setMapProvider(v as 'auto' | 'osm' | 'amap')}
      />
      <Space size={4}>
        {trips.length > 0 && (
          <Button icon={<DownloadOutlined />} size="small" onClick={handleExport} type="text" />
        )}
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="small"
          onClick={() => { setEditingTrip(null); setFormOpen(true) }}
        >
          {'\u65B0\u5EFA'}
        </Button>
      </Space>
    </div>
  )

  const renderPanelBody = () => {
    if (selectedTrip) {
      return (
        <TripDetail
          trip={selectedTrip}
          spots={selectedSpots}
          onBack={handleBack}
          onEdit={() => { setEditingTrip(selectedTrip); setFormOpen(true) }}
          onDeleted={handleBack}
          onDataChanged={notifyChanged}
        />
      )
    }

    return (
      <>
        {/* Compact stats */}
        {trips.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {[
              { label: '\u65C5\u884C', value: `${stats.totalTrips}\u6B21` },
              { label: '\u76EE\u7684\u5730', value: `${stats.destinations}\u4E2A` },
              { label: '\u5929\u6570', value: `${stats.totalDays}\u5929` },
              { label: '\u6253\u5361', value: `${stats.totalSpots}\u4E2A` },
              ...(stats.totalCost > 0 ? [{ label: '\u82B1\u8D39', value: formatCost(stats.totalCost) }] : []),
            ].map(s => (
              <div key={s.label} style={{
                padding: '4px 10px', borderRadius: 20,
                background: `${colorPrimary}08`, fontSize: 12, lineHeight: '18px',
              }}>
                <span style={{ color: '#999' }}>{s.label}</span>{' '}
                <span style={{ fontWeight: 600, color: colorPrimary }}>{s.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        {trips.length > 0 && (allTags.length > 0 || allYears.length > 1) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {allTags.length > 0 && (
              <Select
                placeholder={'\u6807\u7B7E'}
                allowClear
                size="small"
                style={{ minWidth: 90 }}
                value={tagFilter}
                onChange={setTagFilter}
                options={allTags.map(t => ({ label: t, value: t }))}
              />
            )}
            {allYears.length > 1 && (
              <Select
                placeholder={'\u5E74\u4EFD'}
                allowClear
                size="small"
                style={{ minWidth: 75 }}
                value={yearFilter}
                onChange={setYearFilter}
                options={allYears.map(y => ({ label: y, value: y }))}
              />
            )}
            {(tagFilter || yearFilter) && (
              <Text type="secondary" style={{ fontSize: 12, lineHeight: '24px' }}>
                {filteredTrips.length}/{trips.length}
              </Text>
            )}
          </div>
        )}

        {/* Trip list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredTrips.length > 0 ? filteredTrips.map(trip => {
            const days = tripDays(trip.startDate, trip.endDate)
            const spotCount = allSpots.filter(s => s.tripId === trip.id).length
            const photoCount = allSpots.filter(s => s.tripId === trip.id).reduce((n, s) => n + s.photos.length, 0)
            return (
              <div
                key={trip.id}
                onClick={() => handleSelectTrip(trip.id!)}
                style={{
                  borderRadius: 16,
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  background: '#fff',
                  border: '1px solid rgba(0,0,0,0.04)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = `0 4px 16px rgba(0,0,0,0.08), 0 0 0 1px ${colorPrimary}20`
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                {/* Cover photo strip */}
                {trip.coverPhoto && (
                  <div style={{ height: 80, overflow: 'hidden', position: 'relative' }}>
                    <img src={trip.coverPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.15))',
                    }} />
                  </div>
                )}
                <div style={{ padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center' }}>
                  {!trip.coverPhoto && (
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                      background: `linear-gradient(135deg, ${colorPrimary}15, ${colorPrimary}08)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 20, opacity: 0.6 }}>{'\uD83D\uDDFA\uFE0F'}</span>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {trip.title}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      <span style={{
                        fontSize: 11, padding: '1px 8px', borderRadius: 10,
                        background: `${colorPrimary}10`, color: colorPrimary, fontWeight: 500,
                      }}>
                        {trip.destination}
                      </span>
                      <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 10, background: '#f5f5f5', color: '#888' }}>
                        {days}{'\u5929'}
                      </span>
                      {spotCount > 0 && (
                        <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 10, background: '#f5f5f5', color: '#888' }}>
                          {spotCount}地点
                        </span>
                      )}
                      {photoCount > 0 && (
                        <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 10, background: '#f5f5f5', color: '#888' }}>
                          {photoCount}照片
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#bbb', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {formatDateRange(trip.startDate, trip.endDate)}
                      {trip.rating != null && trip.rating > 0 && (
                        <span style={{ color: '#faad14', letterSpacing: -1 }}>{'★'.repeat(trip.rating)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          }) : trips.length > 0 ? (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <Text type="secondary">{'\u6CA1\u6709\u5339\u914D\u7684\u65C5\u884C'}</Text>
            </div>
          ) : (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.25 }}>{'\uD83C\uDF0D'}</div>
              <Text type="secondary">{'\u8FD8\u6CA1\u6709\u65C5\u884C\u8BB0\u5F55'}</Text>
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      <div style={{
        position: 'relative',
        margin: isMobile ? '-12px' : '-24px',
        height: isMobile ? 'calc(100vh - 80px)' : 'calc(100vh - 112px)',
        overflow: 'hidden',
      }}>
        {/* Full-screen background map */}
        <FootprintMap
          trips={trips}
          spots={allSpots}
          height="100%"
          spotCount={spotCount}
          highlightTripId={selectedTripId}
          onTripClick={handleSelectTrip}
        />

        {/* Desktop: side panel */}
        {!isMobile && (
          <>
            <div style={{
              position: 'absolute', top: 12,
              left: panelCollapsed ? 12 : PANEL_WIDTH + 12,
              zIndex: 1000, transition: 'left 0.3s ease',
            }}>
              <Button
                type="text"
                icon={panelCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setPanelCollapsed(!panelCollapsed)}
                style={glassButton}
              />
            </div>

            <div style={{
              position: 'absolute', top: 0, left: 0, bottom: 0,
              width: PANEL_WIDTH,
              transform: panelCollapsed ? `translateX(-${PANEL_WIDTH}px)` : 'translateX(0)',
              transition: 'transform 0.3s ease',
              zIndex: 900,
              ...glassPanel,
              borderRadius: 0,
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
                {panelHeader}
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
                {renderPanelBody()}
              </div>
            </div>
          </>
        )}

        {/* Mobile: bottom sheet */}
        {isMobile && (
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 900,
            height: sheetSnap === 'peek' ? 100 : sheetSnap === 'half' ? '50%' : '85%',
            transition: 'height 0.3s ease',
            ...glassPanel,
            borderRadius: '16px 16px 0 0',
            display: 'flex', flexDirection: 'column',
          }}>
            <div
              onClick={() => {
                if (sheetSnap === 'peek') setSheetSnap('half')
                else if (sheetSnap === 'full') setSheetSnap('half')
                else setSheetSnap(selectedTrip ? 'full' : 'peek')
              }}
              style={{ padding: '10px 0 6px', textAlign: 'center', cursor: 'pointer', flexShrink: 0 }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#ccc', margin: '0 auto' }} />
            </div>
            <div style={{ padding: '0 12px 8px', flexShrink: 0 }}>
              {panelHeader}
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 12px' }}>
              {renderPanelBody()}
            </div>
          </div>
        )}
      </div>

      <TripForm
        open={formOpen}
        trip={editingTrip}
        onClose={() => setFormOpen(false)}
        onSaved={notifyChanged}
      />
    </>
  )
}
