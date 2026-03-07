import { useMemo, useRef, useCallback, useState, useEffect } from 'react'
import { MapContainer, CircleMarker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Button } from 'antd'
import { PlayCircleOutlined, ReloadOutlined, PauseOutlined, CloseOutlined } from '@ant-design/icons'
import type { Trip, TripSpot, TransportType } from '@/shared/db'
import { getTransportEmoji, T } from '../utils'
import { useMapProvider, toDisplayCoord } from '../mapConfig'
import MapTiles from './MapTiles'

interface MarkerData {
  lat: number
  lng: number
  name: string
  tripName: string
  date: string
  tripId: number
  transport?: TransportType
  photo?: string
  address?: string
  isDeparture?: boolean
}

interface Props {
  trips: Trip[]
  spots: TripSpot[]
  height?: number | string
  spotCount?: number
  highlightTripId?: number | null
  onTripClick?: (tripId: number) => void
}

// --------------- Bezier helpers ---------------

function quadBezier(t: number, p0: number, p1: number, p2: number): number {
  const mt = 1 - t
  return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2
}

function bezierControl(
  from: [number, number],
  to: [number, number],
  transport?: TransportType,
): [number, number] {
  const [lat1, lng1] = from
  const [lat2, lng2] = to
  const midLat = (lat1 + lat2) / 2
  const midLng = (lng1 + lng2) / 2

  const dx = lng2 - lng1
  const dy = lat2 - lat1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 0.001) return [midLat, midLng]

  let factor: number
  switch (transport) {
    case 'plane': factor = 0.3; break
    case 'ship': factor = 0.22; break
    case 'train': factor = 0.15; break
    case 'car': case 'bus': factor = 0.12; break
    default: factor = 0.08; break
  }

  const offset = len * factor
  const perpLat = (-dx / len) * offset
  const perpLng = (dy / len) * offset

  return [midLat + perpLat, midLng + perpLng]
}

// --------------- Map helpers ---------------

function BoundsFitter({ coords }: { coords: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (coords.length > 1) {
      map.fitBounds(L.latLngBounds(coords).pad(0.15))
    } else if (coords.length === 1) {
      map.setView(coords[0]!, 12)
    }
    setTimeout(() => map.invalidateSize(), 100)
  }, [map, coords])
  return null
}

// --------------- Footprint Animator ---------------

function FootprintAnimator({ markers, playing, onDone }: {
  markers: MarkerData[]
  playing: boolean
  onDone: () => void
}) {
  const map = useMap()
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const ref = useRef({
    layers: [] as L.Layer[],
    idx: 0,
    step: 0,
    totalSteps: 0,
    fromLat: 0, fromLng: 0,
    ctrlLat: 0, ctrlLng: 0,
    toLat: 0, toLng: 0,
    currentLine: null as L.Polyline | null,
    currentMover: null as L.Marker | null,
    rafId: null as number | null,
    timerId: null as ReturnType<typeof setTimeout> | null,
    started: false,
  })

  const cleanup = useCallback(() => {
    const s = ref.current
    if (s.rafId != null) cancelAnimationFrame(s.rafId)
    if (s.timerId != null) clearTimeout(s.timerId)
    s.rafId = null
    s.timerId = null
    s.layers.forEach((l) => map.removeLayer(l))
    s.layers = []
    s.idx = 0
    s.step = 0
    s.started = false
    s.currentLine = null
    s.currentMover = null
  }, [map])

  useEffect(() => {
    const s = ref.current
    if (!playing) {
      if (s.rafId != null) { cancelAnimationFrame(s.rafId); s.rafId = null }
      if (s.timerId != null) { clearTimeout(s.timerId); s.timerId = null }
      return
    }

    if (!s.started) {
      cleanup()
      s.started = true
      showFirstMarker()
    } else {
      if (s.step > 0 && s.step < s.totalSteps) {
        tick()
      } else {
        processNext()
      }
    }

    function showFirstMarker() {
      if (markers.length === 0) { onDoneRef.current(); return }
      const m = markers[0]!
      const pos = L.latLng(m.lat, m.lng)

      map.flyTo(pos, Math.max(map.getZoom(), 10), { duration: 0.8 })

      s.timerId = setTimeout(() => {
        addPulse(pos)
        const cm = addCircleMarker(m, pos)
        cm.openPopup()

        s.fromLat = m.lat
        s.fromLng = m.lng
        s.idx = 1

        s.timerId = setTimeout(() => {
          cm.closePopup()
          processNext()
        }, 1500)
      }, 900)
    }

    function processNext() {
      const s = ref.current
      if (s.idx >= markers.length) {
        if (markers.length > 1) {
          const allCoords = markers.map(m => L.latLng(m.lat, m.lng))
          map.flyToBounds(L.latLngBounds(allCoords).pad(0.15), { duration: 1.2 })
        }
        s.timerId = setTimeout(() => onDoneRef.current(), 1400)
        return
      }

      const m = markers[s.idx]!
      const prev = markers[s.idx - 1]
      const sameTripAsPrev = prev != null && m.tripId === prev.tripId

      if (!sameTripAsPrev) {
        const to = L.latLng(m.lat, m.lng)
        map.flyTo(to, Math.max(10, Math.min(map.getZoom(), 12)), { duration: 1.2 })
        s.timerId = setTimeout(() => {
          addPulse(to)
          const cm = addCircleMarker(m, to)
          cm.openPopup()

          s.fromLat = m.lat
          s.fromLng = m.lng
          s.idx++

          s.timerId = setTimeout(() => {
            cm.closePopup()
            processNext()
          }, 2000)
        }, 1300)
      } else {
        const from = L.latLng(s.fromLat, s.fromLng)
        const to = L.latLng(m.lat, m.lng)
        animateSegment(from, to, m)
      }
    }

    function animateSegment(from: L.LatLng, to: L.LatLng, m: MarkerData) {
      const s = ref.current
      const dist = from.distanceTo(to)

      s.totalSteps = Math.max(80, Math.min(300, Math.round(dist / 1500)))

      const ctrl = bezierControl([from.lat, from.lng], [to.lat, to.lng], m.transport)
      s.fromLat = from.lat; s.fromLng = from.lng
      s.ctrlLat = ctrl[0]; s.ctrlLng = ctrl[1]
      s.toLat = to.lat; s.toLng = to.lng
      s.step = 0

      const emoji = getTransportEmoji(m.transport)
      const icon = L.divIcon({
        className: '',
        html: `<span style="font-size:22px;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4))">${emoji}</span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })
      s.currentMover = L.marker(from, { icon, zIndexOffset: 1000 }).addTo(map)
      s.layers.push(s.currentMover)
      s.currentLine = L.polyline([from], { color: T.primary, weight: 3, opacity: 0.8 }).addTo(map)
      s.layers.push(s.currentLine)

      tick()
    }

    function tick() {
      const s = ref.current
      s.step++
      const t = s.step / s.totalSteps
      const lat = quadBezier(t, s.fromLat, s.ctrlLat, s.toLat)
      const lng = quadBezier(t, s.fromLng, s.ctrlLng, s.toLng)
      const pos = L.latLng(lat, lng)

      s.currentLine!.addLatLng(pos)
      s.currentMover!.setLatLng(pos)

      map.panTo(pos, { animate: false })

      if (s.step < s.totalSteps) {
        s.rafId = requestAnimationFrame(tick)
      } else {
        arriveAt(markers[s.idx]!)
      }
    }

    function arriveAt(m: MarkerData) {
      const s = ref.current

      if (s.currentMover) {
        map.removeLayer(s.currentMover)
        const mi = s.layers.indexOf(s.currentMover)
        if (mi >= 0) s.layers.splice(mi, 1)
        s.currentMover = null
      }

      const endPos = L.latLng(m.lat, m.lng)

      addPulse(endPos)

      const cm = addCircleMarker(m, endPos)
      cm.openPopup()

      s.fromLat = m.lat
      s.fromLng = m.lng
      s.idx++
      s.step = 0

      const nextM: MarkerData | undefined = markers[s.idx]
      const isTripChange = nextM != null && nextM.tripId !== m.tripId
      const isLast = !nextM
      const delay = isLast ? 2000 : isTripChange ? 2000 : 1200

      s.timerId = setTimeout(() => {
        cm.closePopup()
        processNext()
      }, delay)
    }

    function addPulse(pos: L.LatLng) {
      const pulseIcon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${T.primary};opacity:0.7;animation:fpPulse 0.8s ease-out"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })
      const pulse = L.marker(pos, { icon: pulseIcon, zIndexOffset: 900 }).addTo(map)
      ref.current.layers.push(pulse)
      setTimeout(() => {
        map.removeLayer(pulse)
        const pi = ref.current.layers.indexOf(pulse)
        if (pi >= 0) ref.current.layers.splice(pi, 1)
      }, 800)
    }

    function addCircleMarker(m: MarkerData, pos: L.LatLng): L.CircleMarker {
      const cm = L.circleMarker(pos, {
        radius: 7, color: T.primary, fillColor: T.primary, fillOpacity: 0.8,
      }).addTo(map).bindPopup(`<b>${m.name}</b><br/>${m.tripName}<br/>${m.date}`)
      ref.current.layers.push(cm)
      return cm
    }

    return () => {
      const s = ref.current
      if (s.rafId != null) { cancelAnimationFrame(s.rafId); s.rafId = null }
      if (s.timerId != null) { clearTimeout(s.timerId); s.timerId = null }
    }
  }, [playing]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => cleanup, [cleanup])
  return null
}

// --------------- Glass style ---------------

const glassStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderRadius: 14,
  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  border: '1px solid rgba(0,0,0,0.06)',
  padding: '6px 14px',
}

// --------------- Floating Spot Card ---------------

function SpotCard({ marker, onClose, onClick }: {
  marker: MarkerData
  onClose: () => void
  onClick: () => void
}) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        width: 'min(380px, calc(100% - 32px))',
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        cursor: 'pointer',
        animation: 'spotCardSlideUp 0.3s ease',
      }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', gap: 0 }}>
        {/* Photo */}
        {marker.photo ? (
          <div style={{ width: 120, minHeight: 90, flexShrink: 0 }}>
            <img
              src={marker.photo}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        ) : (
          <div style={{
            width: 90, minHeight: 90, flexShrink: 0,
            background: T.gradientLight,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 28, opacity: 0.5 }}>📍</span>
          </div>
        )}

        {/* Info */}
        <div style={{ flex: 1, padding: '12px 14px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{
            fontWeight: 700, fontSize: 15, color: '#1a1a1a',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {marker.name}
          </div>
          <div style={{
            fontSize: 12, color: '#888', marginTop: 4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {marker.tripName}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 10,
              background: T.primaryBg, color: T.primary, fontWeight: 600,
            }}>
              {marker.date}
            </span>
            {marker.address && (
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 10,
                background: '#f5f5f5', color: '#999',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: 140,
              }}>
                {marker.address}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Close button */}
      <div
        onClick={(e) => { e.stopPropagation(); onClose() }}
        style={{
          position: 'absolute', top: 8, right: 8,
          width: 24, height: 24, borderRadius: '50%',
          background: 'rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <CloseOutlined style={{ color: '#fff', fontSize: 10 }} />
      </div>
    </div>
  )
}

// --------------- Main component ---------------

export default function FootprintMap({ trips, spots, height = 480, spotCount, highlightTripId, onTripClick }: Props) {
  const [provider] = useMapProvider()
  const [animState, setAnimState] = useState<'idle' | 'playing' | 'paused' | 'done'>('idle')
  const [selectedMarker, setSelectedMarker] = useState<MarkerData | null>(null)

  useEffect(() => {
    if (highlightTripId != null) {
      setAnimState('idle')
      setSelectedMarker(null)
    }
  }, [highlightTripId])

  const tripMap = useMemo(() => new Map(trips.map((t) => [t.id, t])), [trips])

  const markers = useMemo(() => {
    const spotsByTrip = new Map<number, MarkerData[]>()
    for (const s of spots) {
      if (s.lat != null && s.lng != null) {
        const trip = tripMap.get(s.tripId)
        const list = spotsByTrip.get(s.tripId) ?? []
        list.push({
          lat: s.lat, lng: s.lng, name: s.name,
          tripName: trip?.title ?? '', date: s.date,
          tripId: s.tripId, transport: s.transport,
          photo: s.photos?.[0],
          address: s.address,
        })
        spotsByTrip.set(s.tripId, list)
      }
    }
    for (const list of spotsByTrip.values()) {
      list.sort((a, b) => a.date.localeCompare(b.date))
    }

    const sortedTrips = [...trips].sort((a, b) => a.startDate.localeCompare(b.startDate))
    const result: MarkerData[] = []

    for (const t of sortedTrips) {
      const tripSpots = spotsByTrip.get(t.id!)
      if (tripSpots && tripSpots.length > 0) {
        if (t.departureLat != null && t.departureLng != null) {
          result.push({
            lat: t.departureLat, lng: t.departureLng,
            name: t.departureName ?? '出发地',
            tripName: t.title, date: t.startDate,
            tripId: t.id!, transport: undefined,
            isDeparture: true,
            photo: t.coverPhoto,
          })
        }
        result.push(...tripSpots)
      } else if (t.lat != null && t.lng != null) {
        result.push({
          lat: t.lat, lng: t.lng, name: t.destination,
          tripName: t.title, date: t.startDate,
          tripId: t.id!, transport: undefined,
          photo: t.coverPhoto,
        })
      }
    }
    return result
  }, [trips, spots, tripMap])

  const displayMarkers = useMemo(
    () => markers.map((m) => {
      const [lat, lng] = toDisplayCoord(m.lat, m.lng, provider)
      return { ...m, lat, lng }
    }),
    [markers, provider],
  )

  const displayCoords = useMemo<[number, number][]>(
    () => displayMarkers.map((m) => [m.lat, m.lng]),
    [displayMarkers],
  )

  const fitCoords = useMemo<[number, number][]>(() => {
    if (highlightTripId != null) {
      const trip = tripMap.get(highlightTripId)
      const hCoords: [number, number][] = []
      if (trip?.departureLat != null && trip?.departureLng != null) {
        const [dLat, dLng] = toDisplayCoord(trip.departureLat, trip.departureLng, provider)
        hCoords.push([dLat, dLng])
      }
      for (const m of displayMarkers) {
        if (m.tripId === highlightTripId) hCoords.push([m.lat, m.lng])
      }
      return hCoords.length > 0 ? hCoords : displayCoords
    }
    return displayCoords
  }, [highlightTripId, displayMarkers, displayCoords, tripMap, provider])

  const highlightRoute = useMemo<[number, number][]>(() => {
    if (highlightTripId == null) return []
    const trip = tripMap.get(highlightTripId)
    const points: [number, number][] = []
    if (trip?.departureLat != null && trip?.departureLng != null) {
      const [dLat, dLng] = toDisplayCoord(trip.departureLat, trip.departureLng, provider)
      points.push([dLat, dLng])
    }
    for (const m of displayMarkers) {
      if (m.tripId === highlightTripId) points.push([m.lat, m.lng])
    }
    return points
  }, [highlightTripId, displayMarkers, tripMap, provider])

  const center: [number, number] = displayCoords.length > 0
    ? [displayCoords.reduce((s, c) => s + c[0], 0) / displayCoords.length,
       displayCoords.reduce((s, c) => s + c[1], 0) / displayCoords.length]
    : [35, 105]

  const handleButtonClick = () => {
    setSelectedMarker(null)
    if (animState === 'idle' || animState === 'done') setAnimState('playing')
    else if (animState === 'playing') setAnimState('paused')
    else if (animState === 'paused') setAnimState('playing')
  }

  const showStaticMarkers = animState === 'idle'

  return (
    <div style={{ position: 'relative', height, overflow: 'hidden' }}>
      <style>{`
        @keyframes fpPulse{0%{transform:scale(1);opacity:0.7}100%{transform:scale(3);opacity:0}}
        @keyframes spotCardSlideUp{0%{opacity:0;transform:translateX(-50%) translateY(20px)}100%{opacity:1;transform:translateX(-50%) translateY(0)}}
      `}</style>

      <MapContainer
        key={provider}
        center={center}
        zoom={4}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <MapTiles provider={provider} />
        {fitCoords.length > 0 && <BoundsFitter coords={fitCoords} />}

        {/* Static markers — upgraded pin style */}
        {showStaticMarkers && displayMarkers.map((m, i) => {
          const isHighlighted = highlightTripId == null || m.tripId === highlightTripId

          if (isHighlighted && (highlightTripId != null || m.isDeparture)) {
            // Use custom pin icon for highlighted or departure markers
            return null // rendered below as L.marker style via CircleMarker override
          }

          return (
            <CircleMarker
              key={i}
              center={[m.lat, m.lng]}
              radius={isHighlighted ? 7 : 4}
              pathOptions={{
                color: T.primary,
                fillColor: T.primary,
                fillOpacity: isHighlighted ? 0.8 : 0.15,
                opacity: isHighlighted ? 1 : 0.2,
                weight: isHighlighted ? 2 : 1,
              }}
              eventHandlers={{
                click: () => {
                  setSelectedMarker(m)
                  onTripClick?.(m.tripId)
                },
              }}
            >
              <Popup>
                <b>{m.name}</b><br />{m.tripName}<br />{m.date}
              </Popup>
            </CircleMarker>
          )
        })}

        {/* Highlighted trip: custom numbered pins */}
        {showStaticMarkers && highlightTripId != null && displayMarkers.map((m, i) => {
          if (m.tripId !== highlightTripId && !m.isDeparture) return null
          if (m.tripId !== highlightTripId) return null

          return (
            <CircleMarker
              key={`hl-${i}`}
              center={[m.lat, m.lng]}
              radius={m.isDeparture ? 10 : 8}
              pathOptions={{
                color: m.isDeparture ? '#faad14' : T.primary,
                fillColor: m.isDeparture ? '#faad14' : T.primary,
                fillOpacity: 0.9,
                weight: 3,
              }}
              eventHandlers={{
                click: () => setSelectedMarker(m),
              }}
            >
              <Popup>
                <b>{m.name}</b><br />{m.tripName}<br />{m.date}
              </Popup>
            </CircleMarker>
          )
        })}

        {/* Departure marker for highlighted trip */}
        {showStaticMarkers && highlightTripId != null && (() => {
          const trip = tripMap.get(highlightTripId)
          if (!trip?.departureLat || !trip?.departureLng) return null
          const [dLat, dLng] = toDisplayCoord(trip.departureLat, trip.departureLng, provider)
          return (
            <CircleMarker
              center={[dLat, dLng]}
              radius={10}
              pathOptions={{ color: '#faad14', fillColor: '#faad14', fillOpacity: 0.9, weight: 3 }}
            >
              <Popup><b>{trip.departureName || '出发地'}</b></Popup>
            </CircleMarker>
          )
        })()}

        {/* Route line for highlighted trip */}
        {showStaticMarkers && highlightRoute.length > 1 && (
          <Polyline
            positions={highlightRoute}
            pathOptions={{ color: T.primary, weight: 3, opacity: 0.6, dashArray: '8,6' }}
          />
        )}

        {/* Animation layer */}
        {(animState === 'playing' || animState === 'paused') && (
          <FootprintAnimator
            markers={displayMarkers}
            playing={animState === 'playing'}
            onDone={() => setAnimState('done')}
          />
        )}
      </MapContainer>

      {/* Play button */}
      {highlightTripId == null && displayMarkers.length > 1 && (
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000 }}>
          <Button
            icon={
              animState === 'playing' ? <PauseOutlined /> :
              animState === 'done' ? <ReloadOutlined /> :
              <PlayCircleOutlined />
            }
            onClick={handleButtonClick}
            size="small"
            style={{
              ...glassStyle,
              background: T.primary,
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              boxShadow: `0 4px 16px ${T.shadow}`,
            }}
          >
            {animState === 'playing' ? '暂停' : animState === 'paused' ? '继续' : animState === 'done' ? '重播' : '播放足迹'}
          </Button>
        </div>
      )}

      {/* Spot count badge */}
      {spotCount != null && !selectedMarker && (
        <div style={{
          position: 'absolute', bottom: 12, right: 12, zIndex: 1000,
          ...glassStyle, fontSize: 12, color: T.text,
        }}>
          共 {spotCount} 个坐标点
        </div>
      )}

      {/* Floating spot card */}
      {selectedMarker && showStaticMarkers && (
        <SpotCard
          marker={selectedMarker}
          onClose={() => setSelectedMarker(null)}
          onClick={() => onTripClick?.(selectedMarker.tripId)}
        />
      )}
    </div>
  )
}
