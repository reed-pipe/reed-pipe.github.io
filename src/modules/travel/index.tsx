import { useState, useMemo } from 'react'
import { Button, Space, Select, Typography, Grid, message } from 'antd'
import { PlusOutlined, DownloadOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import { useLiveQuery } from 'dexie-react-hooks'
import 'leaflet/dist/leaflet.css'
import { useDb } from '@/shared/db/context'
import { useDataChanged } from '@/shared/sync/useDataChanged'
import type { Trip } from '@/shared/db'
import TripForm from './components/TripForm'
import TripDetail from './components/TripDetail'
import FootprintMap from './components/FootprintMap'
import { colors, gradients, shadows } from '@/shared/theme'
import {
  exportTravelCSV, computeStats, formatCost, tripDays, formatDateRange,
  sortTrips, getTripStatusLabel, T,
  type TripSortKey,
} from './utils'

const { Text } = Typography
const { useBreakpoint } = Grid

const PANEL_WIDTH = 370

const SORT_OPTIONS = [
  { label: '按日期', value: 'date' },
  { label: '按创建', value: 'created' },
  { label: '按评分', value: 'rating' },
  { label: '按花费', value: 'cost' },
]

export default function Travel() {
  const db = useDb()
  const notifyChanged = useDataChanged()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const [formOpen, setFormOpen] = useState(false)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [yearFilter, setYearFilter] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<TripSortKey>('date')
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [sheetSnap, setSheetSnap] = useState<'peek' | 'half' | 'full'>('half')

  const trips = useLiveQuery(() => db.trips.orderBy('startDate').filter(r => !r.deletedAt).reverse().toArray(), [db]) ?? []
  const allSpots = useLiveQuery(() => db.tripSpots.filter(r => !r.deletedAt).toArray(), [db]) ?? []

  const filteredTrips = useMemo(() => {
    let result = trips
    if (tagFilter) result = result.filter(t => t.tags.includes(tagFilter))
    if (yearFilter) result = result.filter(t => t.startDate.startsWith(yearFilter))
    return sortTrips(result, sortKey)
  }, [trips, tagFilter, yearFilter, sortKey])

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
    a.download = `旅行记录_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    message.success('导出成功')
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
      <Space size={4}>
        {trips.length > 0 && (
          <Button icon={<DownloadOutlined />} size="small" onClick={handleExport} type="text"
            style={{ borderRadius: 8 }}
          />
        )}
        <Button
          icon={<PlusOutlined />}
          size="small"
          onClick={() => { setEditingTrip(null); setFormOpen(true) }}
          style={{
            background: gradients.primary,
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontWeight: 600,
            boxShadow: shadows.primary,
            height: 30,
          }}
        >
          新建
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
        {/* Stats bar */}
        {trips.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${stats.totalCost > 0 ? 5 : 4}, 1fr)`,
            gap: 6,
            marginBottom: 14,
          }}>
            {[
              { label: '旅行', value: `${stats.totalTrips}`, unit: '次' },
              { label: '目的地', value: `${stats.destinations}`, unit: '个' },
              { label: '天数', value: `${stats.totalDays}`, unit: '天' },
              { label: '打卡', value: `${stats.totalSpots}`, unit: '' },
              ...(stats.totalCost > 0 ? [{ label: '花费', value: formatCost(stats.totalCost), unit: '' }] : []),
            ].map(s => (
              <div key={s.label} style={{
                padding: '8px 6px',
                borderRadius: 12,
                background: colors.bg,
                border: `1px solid ${colors.borderLight}`,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: colors.primary, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                  {s.value}{s.unit && <span style={{ fontSize: 10, fontWeight: 500 }}>{s.unit}</span>}
                </div>
                <div style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters + Sort */}
        {trips.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
            <Select
              size="small" value={sortKey} onChange={setSortKey}
              options={SORT_OPTIONS}
              style={{ minWidth: 80 }}
            />
            {allTags.length > 0 && (
              <Select placeholder="标签" allowClear size="small"
                style={{ minWidth: 90 }} value={tagFilter} onChange={setTagFilter}
                options={allTags.map(t => ({ label: t, value: t }))}
              />
            )}
            {allYears.length > 1 && (
              <Select placeholder="年份" allowClear size="small"
                style={{ minWidth: 75 }} value={yearFilter} onChange={setYearFilter}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredTrips.length > 0 ? filteredTrips.map(trip => {
            const days = tripDays(trip.startDate, trip.endDate)
            const tripSpotCount = allSpots.filter(s => s.tripId === trip.id).length
            const photoCount = allSpots.filter(s => s.tripId === trip.id).reduce((n, s) => n + s.photos.length, 0)
            const statusLabel = getTripStatusLabel(trip)
            const isActive = statusLabel.text !== '已完成'

            return (
              <div
                key={trip.id}
                className="card-hover"
                onClick={() => handleSelectTrip(trip.id!)}
                style={{
                  ...T.glassCard,
                  cursor: 'pointer',
                  overflow: 'hidden',
                }}
              >
                {/* Cover photo strip */}
                {trip.coverPhoto ? (
                  <div style={{ height: 100, overflow: 'hidden', position: 'relative' }}>
                    <img src={trip.coverPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(transparent 20%, rgba(0,0,0,0.45))',
                    }} />
                    <div style={{
                      position: 'absolute', bottom: 10, left: 14, right: 14,
                    }}>
                      <div style={{
                        fontWeight: 700, fontSize: 15, color: '#fff',
                        textShadow: '0 1px 4px rgba(0,0,0,0.3)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {trip.title}
                      </div>
                    </div>
                    {isActive && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8,
                        padding: '2px 10px', borderRadius: 10,
                        background: 'rgba(255,255,255,0.9)',
                        backdropFilter: 'blur(8px)',
                        color: statusLabel.color,
                        fontSize: 10, fontWeight: 600,
                      }}>
                        {statusLabel.text}
                      </div>
                    )}
                  </div>
                ) : (
                  /* No cover — gradient mini hero */
                  <div style={{
                    height: 56, overflow: 'hidden', position: 'relative',
                    background: gradients.primary,
                  }}>
                    {/* Decorative circles */}
                    <div style={{
                      position: 'absolute', top: -10, right: -10,
                      width: 40, height: 40, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.1)',
                    }} />
                    <div style={{
                      position: 'absolute', bottom: -8, left: 20,
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.08)',
                    }} />
                    <div style={{
                      position: 'absolute', bottom: 8, left: 14,
                      fontWeight: 700, fontSize: 15, color: '#fff',
                      textShadow: '0 1px 4px rgba(0,0,0,0.15)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      right: 80,
                    }}>
                      {trip.title}
                    </div>
                    {isActive && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8,
                        padding: '2px 10px', borderRadius: 10,
                        background: 'rgba(255,255,255,0.25)',
                        backdropFilter: 'blur(8px)',
                        color: '#fff',
                        fontSize: 10, fontWeight: 600,
                      }}>
                        {statusLabel.text}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 11, padding: '2px 10px', borderRadius: 10,
                      background: colors.primaryBg, color: colors.primary, fontWeight: 600,
                    }}>
                      {trip.destination}
                    </span>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 10,
                      background: colors.bg, color: colors.textTertiary,
                    }}>
                      {days}天
                    </span>
                    {tripSpotCount > 0 && (
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 10,
                        background: colors.bg, color: colors.textTertiary,
                      }}>
                        {tripSpotCount}地点
                      </span>
                    )}
                    {photoCount > 0 && (
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 10,
                        background: colors.bg, color: colors.textTertiary,
                      }}>
                        {photoCount}照片
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 11, color: colors.textTertiary, marginTop: 5,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {formatDateRange(trip.startDate, trip.endDate)}
                    {trip.rating != null && trip.rating > 0 && (
                      <span style={{ color: '#faad14', letterSpacing: -1 }}>{'★'.repeat(trip.rating)}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          }) : trips.length > 0 ? (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <Text type="secondary">没有匹配的旅行</Text>
            </div>
          ) : (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 42, marginBottom: 12, opacity: 0.2 }}>🌍</div>
              <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 16 }}>还没有旅行记录</Text>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => { setEditingTrip(null); setFormOpen(true) }}
                style={{
                  background: gradients.primary,
                  border: 'none', borderRadius: 20,
                  fontWeight: 600,
                  boxShadow: shadows.primary,
                }}
              >
                创建第一次旅行
              </Button>
            </div>
          )}
        </div>
      </>
    )
  }

  const panelGlass: React.CSSProperties = {
    ...T.glass,
    background: 'rgba(255,255,255,0.82)',
  }

  return (
    <>
      <div style={{
        position: 'relative',
        margin: isMobile ? '-12px' : '-24px',
        height: isMobile ? 'calc(100vh - 80px)' : 'calc(100vh - 112px)',
        overflow: 'hidden',
      }}>
        <FootprintMap
          trips={trips}
          spots={allSpots}
          height="100%"
          spotCount={spotCount}
          highlightTripId={selectedTripId}
          onTripClick={handleSelectTrip}
        />

        {/* Desktop: glass side panel */}
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
                style={{
                  ...T.glassButton,
                  padding: '4px 8px',
                  height: 'auto',
                }}
              />
            </div>

            <div style={{
              position: 'absolute', top: 0, left: 0, bottom: 0,
              width: PANEL_WIDTH,
              transform: panelCollapsed ? `translateX(-${PANEL_WIDTH}px)` : 'translateX(0)',
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              zIndex: 900,
              ...panelGlass,
              borderRadius: 0,
              borderRight: '1px solid rgba(255,255,255,0.3)',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{
                padding: '14px 18px 10px',
                borderBottom: '1px solid rgba(0,0,0,0.05)',
                flexShrink: 0,
                background: 'rgba(255,255,255,0.3)',
              }}>
                {panelHeader}
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px' }}>
                {renderPanelBody()}
              </div>
            </div>
          </>
        )}

        {/* Mobile: glass bottom sheet */}
        {isMobile && (
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 900,
            height: sheetSnap === 'peek' ? 100 : sheetSnap === 'half' ? '50%' : '85%',
            transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            ...panelGlass,
            borderRadius: '20px 20px 0 0',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div
              onClick={() => {
                if (sheetSnap === 'peek') setSheetSnap('half')
                else if (sheetSnap === 'full') setSheetSnap('half')
                else setSheetSnap(selectedTrip ? 'full' : 'peek')
              }}
              style={{ padding: '12px 0 8px', textAlign: 'center', cursor: 'pointer', flexShrink: 0 }}
            >
              <div style={{
                width: 40, height: 4, borderRadius: 2, margin: '0 auto',
                background: 'rgba(0,0,0,0.12)',
              }} />
            </div>
            <div style={{ padding: '0 14px 8px', flexShrink: 0 }}>
              {panelHeader}
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '0 14px 14px' }}>
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
