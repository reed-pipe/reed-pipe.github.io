import { useMemo, useRef, useCallback, useState, useEffect } from 'react'
import { MapContainer, CircleMarker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Button, theme } from 'antd'
import { PlayCircleOutlined, ReloadOutlined, PauseOutlined } from '@ant-design/icons'
import type { Trip, TripSpot, TransportType } from '@/shared/db'
import { getTransportEmoji } from '../utils'
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
}

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

/**
 * Footprint animation with transport emoji + map following.
 * - Same-trip transitions: emoji moves smoothly along the path (rAF), polyline trail drawn behind
 * - Different-trip transitions: map flies to the new location
 * - Map pans to follow the moving emoji in real time
 */
function FootprintAnimator({ markers, playing, colorPrimary, onDone }: {
  markers: MarkerData[]
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
    step: 0,
    totalSteps: 0,
    dLat: 0,
    dLng: 0,
    fromPos: null as L.LatLng | null,
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
    s.fromPos = null
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
      // Resume from pause
      if (s.step > 0 && s.step < s.totalSteps) {
        tick()
      } else {
        processNext()
      }
    }

    /** Show the very first marker and fly to it */
    function showFirstMarker() {
      if (markers.length === 0) { onDoneRef.current(); return }
      const m = markers[0]!
      const pos = L.latLng(m.lat, m.lng)

      addCircleMarker(m, pos)
      s.fromPos = pos
      s.idx = 1

      map.flyTo(pos, Math.max(map.getZoom(), 10), { duration: 0.6 })
      s.timerId = setTimeout(processNext, 700)
    }

    /** Process the next marker: animate or fly depending on trip continuity */
    function processNext() {
      const s = ref.current
      if (s.idx >= markers.length) {
        // Animation complete — zoom out to show all
        if (markers.length > 1) {
          const allCoords = markers.map(m => L.latLng(m.lat, m.lng))
          map.flyToBounds(L.latLngBounds(allCoords).pad(0.15), { duration: 1 })
        }
        s.timerId = setTimeout(() => onDoneRef.current(), 1100)
        return
      }

      const m = markers[s.idx]!
      const prev = markers[s.idx - 1]
      const to = L.latLng(m.lat, m.lng)
      const sameTripAsPrev = prev != null && m.tripId === prev.tripId

      if (!sameTripAsPrev) {
        // Different trip — fly to new location, then place marker
        map.flyTo(to, Math.max(10, Math.min(map.getZoom(), 12)), { duration: 1 })
        s.timerId = setTimeout(() => {
          addCircleMarker(m, to)
          s.fromPos = to
          s.idx++
          s.timerId = setTimeout(processNext, 400)
        }, 1100)
      } else {
        // Same trip — animate with transport emoji
        animateSegment(s.fromPos!, to, m)
      }
    }

    /** Smoothly animate a transport emoji from `from` to `to` */
    function animateSegment(from: L.LatLng, to: L.LatLng, m: MarkerData) {
      const s = ref.current
      const dist = from.distanceTo(to)
      s.totalSteps = Math.max(40, Math.min(150, Math.round(dist / 3000)))
      s.dLat = (to.lat - from.lat) / s.totalSteps
      s.dLng = (to.lng - from.lng) / s.totalSteps
      s.fromPos = from
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
      s.currentLine = L.polyline([from], { color: colorPrimary, weight: 3, opacity: 0.8 }).addTo(map)
      s.layers.push(s.currentLine)

      tick()
    }

    /** RAF tick: move emoji one step, draw trail, pan map */
    function tick() {
      const s = ref.current
      s.step++
      const lat = s.fromPos!.lat + s.dLat * s.step
      const lng = s.fromPos!.lng + s.dLng * s.step
      const pos = L.latLng(lat, lng)

      s.currentLine!.addLatLng(pos)
      s.currentMover!.setLatLng(pos)

      // Map follows the mover
      map.panTo(pos, { animate: false })

      if (s.step < s.totalSteps) {
        s.rafId = requestAnimationFrame(tick)
      } else {
        // Arrived — remove mover, show circle marker
        const m = markers[s.idx]!
        if (s.currentMover) {
          map.removeLayer(s.currentMover)
          const mi = s.layers.indexOf(s.currentMover)
          if (mi >= 0) s.layers.splice(mi, 1)
          s.currentMover = null
        }

        const endPos = L.latLng(m.lat, m.lng)
        addCircleMarker(m, endPos)
        s.fromPos = endPos
        s.idx++
        s.step = 0

        const nextM: MarkerData | undefined = markers[s.idx]
        const delay = (nextM && nextM.tripId !== m.tripId) ? 600 : 300
        s.timerId = setTimeout(processNext, delay)
      }
    }

    /** Helper: add a permanent circle marker at a position */
    function addCircleMarker(m: MarkerData, pos: L.LatLng) {
      const cm = L.circleMarker(pos, {
        radius: 7, color: colorPrimary, fillColor: colorPrimary, fillOpacity: 0.8,
      }).addTo(map).bindPopup(`<b>${m.name}</b><br/>${m.tripName}<br/>${m.date}`)
      ref.current.layers.push(cm)
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
    const result: MarkerData[] = []
    for (const s of spots) {
      if (s.lat != null && s.lng != null) {
        const trip = tripMap.get(s.tripId)
        result.push({
          lat: s.lat, lng: s.lng, name: s.name,
          tripName: trip?.title ?? '', date: s.date,
          tripId: s.tripId, transport: s.transport,
        })
      }
    }
    const tripsWithSpotCoords = new Set(spots.filter((s) => s.lat != null && s.lng != null).map((s) => s.tripId))
    for (const t of trips) {
      if (t.lat != null && t.lng != null && !tripsWithSpotCoords.has(t.id)) {
        result.push({
          lat: t.lat, lng: t.lng, name: t.destination,
          tripName: t.title, date: t.startDate,
          tripId: t.id!, transport: undefined,
        })
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
