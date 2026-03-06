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

// --------------- Bezier helpers ---------------

/** Quadratic bezier interpolation */
function quadBezier(t: number, p0: number, p1: number, p2: number): number {
  const mt = 1 - t
  return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2
}

/** Compute a control point for a curved arc between two coordinates */
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

  // Curvature factor by transport type
  let factor: number
  switch (transport) {
    case 'plane': factor = 0.3; break
    case 'ship': factor = 0.22; break
    case 'train': factor = 0.15; break
    case 'car': case 'bus': factor = 0.12; break
    default: factor = 0.08; break
  }

  // Perpendicular offset (rotate direction 90 degrees)
  const offset = len * factor
  const perpLat = (-dx / len) * offset
  const perpLng = (dy / len) * offset

  return [midLat + perpLat, midLng + perpLng]
}

// --------------- Map helpers ---------------

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

// --------------- Footprint Animator ---------------

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
    // Bezier params for current segment
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
      // Resume from pause
      if (s.step > 0 && s.step < s.totalSteps) {
        tick()
      } else {
        processNext()
      }
    }

    /** Show the very first marker, fly to it, pause to let user see */
    function showFirstMarker() {
      if (markers.length === 0) { onDoneRef.current(); return }
      const m = markers[0]!
      const pos = L.latLng(m.lat, m.lng)

      // Fly to first point
      map.flyTo(pos, Math.max(map.getZoom(), 10), { duration: 0.8 })

      s.timerId = setTimeout(() => {
        addPulse(pos)
        const cm = addCircleMarker(m, pos)
        cm.openPopup()

        s.fromLat = m.lat
        s.fromLng = m.lng
        s.idx = 1

        // Pause to let user see the first point
        s.timerId = setTimeout(() => {
          cm.closePopup()
          processNext()
        }, 1500)
      }, 900)
    }

    /** Decide how to handle the next marker */
    function processNext() {
      const s = ref.current
      if (s.idx >= markers.length) {
        // Animation complete — zoom out to show everything
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
        // Different trip — fly to new location
        const to = L.latLng(m.lat, m.lng)
        map.flyTo(to, Math.max(10, Math.min(map.getZoom(), 12)), { duration: 1.2 })
        s.timerId = setTimeout(() => {
          addPulse(to)
          const cm = addCircleMarker(m, to)
          cm.openPopup()

          s.fromLat = m.lat
          s.fromLng = m.lng
          s.idx++

          // Longer pause between trips
          s.timerId = setTimeout(() => {
            cm.closePopup()
            processNext()
          }, 2000)
        }, 1300)
      } else {
        // Same trip — animate with bezier curve + transport emoji
        const from = L.latLng(s.fromLat, s.fromLng)
        const to = L.latLng(m.lat, m.lng)
        animateSegment(from, to, m)
      }
    }

    /** Set up bezier curve animation between two points */
    function animateSegment(from: L.LatLng, to: L.LatLng, m: MarkerData) {
      const s = ref.current
      const dist = from.distanceTo(to)

      // Slower: ~1.3s to 5s per segment
      s.totalSteps = Math.max(80, Math.min(300, Math.round(dist / 1500)))

      // Bezier control point for curved path
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
      s.currentLine = L.polyline([from], { color: colorPrimary, weight: 3, opacity: 0.8 }).addTo(map)
      s.layers.push(s.currentLine)

      tick()
    }

    /** RAF tick: advance one step along bezier curve */
    function tick() {
      const s = ref.current
      s.step++
      const t = s.step / s.totalSteps
      const lat = quadBezier(t, s.fromLat, s.ctrlLat, s.toLat)
      const lng = quadBezier(t, s.fromLng, s.ctrlLng, s.toLng)
      const pos = L.latLng(lat, lng)

      s.currentLine!.addLatLng(pos)
      s.currentMover!.setLatLng(pos)

      // Map follows the mover
      map.panTo(pos, { animate: false })

      if (s.step < s.totalSteps) {
        s.rafId = requestAnimationFrame(tick)
      } else {
        arriveAt(markers[s.idx]!)
      }
    }

    /** Handle arrival: pulse, popup, pause, then continue */
    function arriveAt(m: MarkerData) {
      const s = ref.current

      // Remove mover emoji
      if (s.currentMover) {
        map.removeLayer(s.currentMover)
        const mi = s.layers.indexOf(s.currentMover)
        if (mi >= 0) s.layers.splice(mi, 1)
        s.currentMover = null
      }

      const endPos = L.latLng(m.lat, m.lng)

      // Pulse effect at arrival
      addPulse(endPos)

      // Place permanent circle marker with popup
      const cm = addCircleMarker(m, endPos)
      cm.openPopup()

      s.fromLat = m.lat
      s.fromLng = m.lng
      s.idx++
      s.step = 0

      // Check if next marker is a different trip
      const nextM: MarkerData | undefined = markers[s.idx]
      const isTripChange = nextM != null && nextM.tripId !== m.tripId
      const isLast = !nextM
      const delay = isLast ? 2000 : isTripChange ? 2000 : 1200

      s.timerId = setTimeout(() => {
        cm.closePopup()
        processNext()
      }, delay)
    }

    /** Add a pulse animation at a position */
    function addPulse(pos: L.LatLng) {
      const pulseIcon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${colorPrimary};opacity:0.7;animation:fpPulse 0.8s ease-out"></div>`,
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

    /** Add a permanent circle marker */
    function addCircleMarker(m: MarkerData, pos: L.LatLng): L.CircleMarker {
      const cm = L.circleMarker(pos, {
        radius: 7, color: colorPrimary, fillColor: colorPrimary, fillOpacity: 0.8,
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
  background: 'rgba(255,255,255,0.88)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderRadius: 14,
  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  border: '1px solid rgba(0,0,0,0.06)',
  padding: '6px 14px',
}

// --------------- Main component ---------------

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

  // Coords to fit bounds: highlighted trip (including departure) or all
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

  // Route polyline for highlighted trip (including departure)
  const highlightRoute = useMemo<[number, number][]>(() => {
    if (highlightTripId == null) return []
    const trip = tripMap.get(highlightTripId)
    const points: [number, number][] = []
    // Include departure point
    if (trip?.departureLat != null && trip?.departureLng != null) {
      const [dLat, dLng] = toDisplayCoord(trip.departureLat, trip.departureLng, provider)
      points.push([dLat, dLng])
    }
    // Add spots
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
    if (animState === 'idle' || animState === 'done') setAnimState('playing')
    else if (animState === 'playing') setAnimState('paused')
    else if (animState === 'paused') setAnimState('playing')
  }

  const showStaticMarkers = animState === 'idle'

  return (
    <div style={{ position: 'relative', height, overflow: 'hidden' }}>
      {/* Pulse animation CSS */}
      <style>{`@keyframes fpPulse{0%{transform:scale(1);opacity:0.7}100%{transform:scale(3);opacity:0}}`}</style>

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

        {/* Departure marker for highlighted trip */}
        {showStaticMarkers && highlightTripId != null && (() => {
          const trip = tripMap.get(highlightTripId)
          if (!trip?.departureLat || !trip?.departureLng) return null
          const [dLat, dLng] = toDisplayCoord(trip.departureLat, trip.departureLng, provider)
          return (
            <CircleMarker
              center={[dLat, dLng]}
              radius={8}
              pathOptions={{ color: '#faad14', fillColor: '#faad14', fillOpacity: 0.9, weight: 2 }}
            >
              <Popup><b>{trip.departureName || '出发地'}</b></Popup>
            </CircleMarker>
          )
        })()}

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
