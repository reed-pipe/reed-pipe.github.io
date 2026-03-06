import { useMemo, useRef, useCallback, useState, useEffect } from 'react'
import { MapContainer, CircleMarker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Button, theme } from 'antd'
import { PlayCircleOutlined, ReloadOutlined, PauseOutlined } from '@ant-design/icons'
import type { Trip, TripSpot } from '@/shared/db'
import { useMapProvider, toDisplayCoord } from '../mapConfig'
import MapTiles from './MapTiles'

interface Props {
  trips: Trip[]
  spots: TripSpot[]
  height?: number | string
  spotCount?: number
  highlightTripId?: number | null
  onTripClick?: (tripId: number) => void
}

/** Fit bounds when data/provider changes */
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

/** Footprint animation: markers appear chronologically */
function FootprintAnimator({ markers, playing, colorPrimary, onDone }: {
  markers: { lat: number; lng: number; name: string; tripName: string; date: string; tripId: number }[]
  playing: boolean
  colorPrimary: string
  onDone: () => void
}) {
  const map = useMap()
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const ref = useRef({
    layers: [] as L.Layer[],
    idx: 0,
    timerId: null as ReturnType<typeof setTimeout> | null,
    prevTripId: null as number | null,
    prevPos: null as L.LatLng | null,
    started: false,
  })

  const cleanup = useCallback(() => {
    const s = ref.current
    if (s.timerId != null) clearTimeout(s.timerId)
    s.timerId = null
    s.layers.forEach((l) => map.removeLayer(l))
    s.layers = []
    s.idx = 0
    s.prevTripId = null
    s.prevPos = null
    s.started = false
  }, [map])

  useEffect(() => {
    const s = ref.current
    if (!playing) {
      if (s.timerId != null) { clearTimeout(s.timerId); s.timerId = null }
      return
    }

    if (!s.started) {
      cleanup()
      s.started = true
    }
    showNext()

    function showNext() {
      const s = ref.current
      if (s.idx >= markers.length) {
        onDoneRef.current()
        return
      }
      const m = markers[s.idx]!
      const pos = L.latLng(m.lat, m.lng)

      // Connect within same trip
      if (s.prevPos && m.tripId === s.prevTripId) {
        const line = L.polyline([s.prevPos, pos], { color: colorPrimary, weight: 2.5, opacity: 0.6, dashArray: '6,4' }).addTo(map)
        s.layers.push(line)
      }

      // Pulse marker
      const pulseIcon = L.divIcon({
        className: '',
        html: `<div style="width:12px;height:12px;border-radius:50%;background:${colorPrimary};opacity:0.6;animation:fpPulse 0.5s ease-out"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      })
      const pulse = L.marker(pos, { icon: pulseIcon, zIndexOffset: 900 }).addTo(map)
      s.layers.push(pulse)

      setTimeout(() => {
        map.removeLayer(pulse)
        const pi = s.layers.indexOf(pulse)
        if (pi >= 0) s.layers.splice(pi, 1)
        const cm = L.circleMarker(pos, { radius: 6, color: colorPrimary, fillColor: colorPrimary, fillOpacity: 0.7 })
          .addTo(map).bindPopup(`<b>${m.name}</b><br/>${m.tripName}<br/>${m.date}`)
        s.layers.push(cm)
      }, 250)

      s.prevPos = pos
      s.prevTripId = m.tripId
      s.idx++

      const nextM: typeof markers[number] | undefined = markers[s.idx]
      const delay = (nextM && nextM.tripId !== m.tripId) ? 500 : 300
      s.timerId = setTimeout(showNext, delay)
    }

    return () => {
      const s = ref.current
      if (s.timerId != null) { clearTimeout(s.timerId); s.timerId = null }
    }
  }, [playing]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => cleanup, [cleanup])
  return null
}

const glassStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.88)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderRadius: 14,
  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  border: '1px solid rgba(0,0,0,0.06)',
  padding: '6px 14px',
}

export default function FootprintMap({ trips, spots, height = 480, spotCount, highlightTripId, onTripClick }: Props) {
  const { token: { colorPrimary } } = theme.useToken()
  const [provider] = useMapProvider()
  const [animState, setAnimState] = useState<'idle' | 'playing' | 'paused' | 'done'>('idle')

  // Reset animation when a trip is highlighted
  useEffect(() => {
    if (highlightTripId != null) setAnimState('idle')
  }, [highlightTripId])

  const tripMap = useMemo(() => new Map(trips.map((t) => [t.id, t])), [trips])

  const markers = useMemo(() => {
    const result: { lat: number; lng: number; name: string; tripName: string; date: string; tripId: number }[] = []
    for (const s of spots) {
      if (s.lat != null && s.lng != null) {
        const trip = tripMap.get(s.tripId)
        result.push({ lat: s.lat, lng: s.lng, name: s.name, tripName: trip?.title ?? '', date: s.date, tripId: s.tripId })
      }
    }
    const tripsWithSpotCoords = new Set(spots.filter((s) => s.lat != null && s.lng != null).map((s) => s.tripId))
    for (const t of trips) {
      if (t.lat != null && t.lng != null && !tripsWithSpotCoords.has(t.id)) {
        result.push({ lat: t.lat, lng: t.lng, name: t.destination, tripName: t.title, date: t.startDate, tripId: t.id! })
      }
    }
    result.sort((a, b) => a.date.localeCompare(b.date))
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

  // Coords to fit bounds: highlighted trip or all
  const fitCoords = useMemo<[number, number][]>(() => {
    if (highlightTripId != null) {
      const hCoords = displayMarkers
        .filter(m => m.tripId === highlightTripId)
        .map(m => [m.lat, m.lng] as [number, number])
      return hCoords.length > 0 ? hCoords : displayCoords
    }
    return displayCoords
  }, [highlightTripId, displayMarkers, displayCoords])

  // Route polyline for highlighted trip
  const highlightRoute = useMemo<[number, number][]>(() => {
    if (highlightTripId == null) return []
    return displayMarkers
      .filter(m => m.tripId === highlightTripId)
      .map(m => [m.lat, m.lng] as [number, number])
  }, [highlightTripId, displayMarkers])

  const center: [number, number] = displayCoords.length > 0
    ? [displayCoords.reduce((s, c) => s + c[0], 0) / displayCoords.length,
       displayCoords.reduce((s, c) => s + c[1], 0) / displayCoords.length]
    : [35, 105]

  const handleButtonClick = () => {
    if (animState === 'idle' || animState === 'done') setAnimState('playing')
    else if (animState === 'playing') setAnimState('paused')
    else if (animState === 'paused') setAnimState('playing')
  }

  const showStaticMarkers = animState === 'idle'

  return (
    <div style={{ position: 'relative', height, overflow: 'hidden' }}>
      {/* Inject pulse animation CSS */}
      <style>{`@keyframes fpPulse{0%{transform:scale(1);opacity:0.6}100%{transform:scale(2.5);opacity:0}}`}</style>

      <MapContainer
        key={provider}
        center={center}
        zoom={4}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <MapTiles provider={provider} />
        {fitCoords.length > 0 && <BoundsFitter coords={fitCoords} />}

        {/* Static markers */}
        {showStaticMarkers && displayMarkers.map((m, i) => {
          const isHighlighted = highlightTripId == null || m.tripId === highlightTripId
          return (
            <CircleMarker
              key={i}
              center={[m.lat, m.lng]}
              radius={isHighlighted ? 7 : 4}
              pathOptions={{
                color: colorPrimary,
                fillColor: colorPrimary,
                fillOpacity: isHighlighted ? 0.8 : 0.15,
                opacity: isHighlighted ? 1 : 0.2,
                weight: isHighlighted ? 2 : 1,
              }}
              eventHandlers={{
                click: () => onTripClick?.(m.tripId),
              }}
            >
              <Popup>
                <b>{m.name}</b><br />{m.tripName}<br />{m.date}
              </Popup>
            </CircleMarker>
          )
        })}

        {/* Route line for highlighted trip */}
        {showStaticMarkers && highlightRoute.length > 1 && (
          <Polyline
            positions={highlightRoute}
            pathOptions={{ color: colorPrimary, weight: 3, opacity: 0.6, dashArray: '8,6' }}
          />
        )}

        {/* Animation layer */}
        {(animState === 'playing' || animState === 'paused') && (
          <FootprintAnimator
            markers={displayMarkers}
            playing={animState === 'playing'}
            colorPrimary={colorPrimary}
            onDone={() => setAnimState('done')}
          />
        )}
      </MapContainer>

      {/* Play button — only when no trip highlighted */}
      {highlightTripId == null && displayMarkers.length > 1 && (
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000 }}>
          <Button
            type="primary"
            icon={
              animState === 'playing' ? <PauseOutlined /> :
              animState === 'done' ? <ReloadOutlined /> :
              <PlayCircleOutlined />
            }
            onClick={handleButtonClick}
            size="small"
            style={{ ...glassStyle, background: colorPrimary, color: '#fff', border: 'none' }}
          >
            {animState === 'playing' ? '\u6682\u505C' : animState === 'paused' ? '\u7EE7\u7EED' : animState === 'done' ? '\u91CD\u64AD' : '\u64AD\u653E\u8DB3\u8FF9'}
          </Button>
        </div>
      )}

      {spotCount != null && (
        <div style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 1000, ...glassStyle, fontSize: 12, color: '#666' }}>
          {'\u5171'} {spotCount} {'\u4E2A\u5750\u6807\u70B9'}
        </div>
      )}
    </div>
  )
}
