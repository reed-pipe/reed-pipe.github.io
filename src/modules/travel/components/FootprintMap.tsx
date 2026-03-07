import { useMemo, useRef, useCallback, useState, useEffect } from 'react'
import { MapContainer, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Button, Spin } from 'antd'
import { PlayCircleOutlined, ReloadOutlined, PauseOutlined, CloseOutlined, LoadingOutlined } from '@ant-design/icons'
import type { Trip, TripSpot, TransportType } from '@/shared/db'
import { getTransportEmoji, T } from '../utils'
import { toDisplayCoord } from '../mapConfig'
import { fetchRoute, usesCurve } from '../routing'
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

// --------------- Pin icon builders ---------------

function pinIcon(label: string, opts: {
  bg: string; size?: number; fontSize?: number;
  shadow?: string; glow?: boolean;
}): L.DivIcon {
  const sz = opts.size ?? 30
  const fs = opts.fontSize ?? 11
  const shadow = opts.shadow ?? '0 3px 10px rgba(0,0,0,0.25)'
  const glow = opts.glow ? `0 0 8px ${T.primary}60,` : ''
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:${sz}px;height:${sz + 8}px;filter:drop-shadow(${shadow})">
      <div style="
        width:${sz}px;height:${sz}px;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        background:${opts.bg};
        border:2.5px solid rgba(255,255,255,0.9);
        box-shadow:${glow} inset 0 -2px 4px rgba(0,0,0,0.15), inset 0 2px 4px rgba(255,255,255,0.3);
        display:flex;align-items:center;justify-content:center;
      ">
        <span style="transform:rotate(45deg);color:#fff;font-size:${fs}px;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,0.2)">${label}</span>
      </div>
    </div>`,
    iconSize: [sz, sz + 8],
    iconAnchor: [sz / 2, sz + 8],
  })
}

function homeIcon(): L.DivIcon {
  return pinIcon('🏠', {
    bg: 'linear-gradient(135deg, #faad14, #ffc53d)',
    size: 32, fontSize: 14,
    shadow: '0 3px 10px rgba(250,173,20,0.4)',
  })
}

function spotPin(index: number, highlighted: boolean): L.DivIcon {
  return pinIcon(String(index + 1), {
    bg: highlighted ? T.gradient : `linear-gradient(135deg, ${T.primary}bb, ${T.primary}88)`,
    size: highlighted ? 32 : 24,
    fontSize: highlighted ? 12 : 10,
    shadow: highlighted ? `0 3px 12px ${T.shadow}` : '0 2px 6px rgba(0,0,0,0.2)',
    glow: highlighted,
  })
}

function dimDot(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:10px;height:10px;border-radius:50%;background:${T.primary}40;border:1.5px solid rgba(255,255,255,0.5);box-shadow:0 1px 3px rgba(0,0,0,0.1)"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  })
}

// --------------- Bezier helpers (fallback for plane/ship) ---------------

function quadBezier(t: number, p0: number, p1: number, p2: number): number {
  const mt = 1 - t
  return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2
}

function bezierControl(
  from: [number, number], to: [number, number], transport?: TransportType,
): [number, number] {
  const [lat1, lng1] = from
  const [lat2, lng2] = to
  const midLat = (lat1 + lat2) / 2
  const midLng = (lng1 + lng2) / 2
  const dx = lng2 - lng1
  const dy = lat2 - lat1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 0.001) return [midLat, midLng]
  const factor = transport === 'plane' ? 0.3 : 0.22
  const offset = len * factor
  return [midLat + (-dx / len) * offset, midLng + (dy / len) * offset]
}

/** Generate bezier curve positions */
function bezierPositions(
  from: [number, number], to: [number, number], transport?: TransportType, steps = 150,
): [number, number][] {
  const ctrl = bezierControl(from, to, transport)
  const positions: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    positions.push([
      quadBezier(t, from[0], ctrl[0], to[0]),
      quadBezier(t, from[1], ctrl[1], to[1]),
    ])
  }
  return positions
}

// --------------- Map helpers ---------------

function BoundsFitter({ coords }: { coords: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (coords.length > 1) map.fitBounds(L.latLngBounds(coords).pad(0.15))
    else if (coords.length === 1) map.setView(coords[0]!, 12)
    setTimeout(() => map.invalidateSize(), 100)
  }, [map, coords])
  return null
}

// --------------- Static Markers (imperative) ---------------

function StaticMarkers({ markers, highlightTripId, tripMap, onMarkerClick, onTripClick }: {
  markers: MarkerData[]
  highlightTripId: number | null | undefined
  tripMap: Map<number, Trip>
  onMarkerClick: (m: MarkerData) => void
  onTripClick?: (tripId: number) => void
}) {
  const map = useMap()
  const layersRef = useRef<L.Layer[]>([])

  useEffect(() => {
    layersRef.current.forEach(l => map.removeLayer(l))
    layersRef.current = []

    if (highlightTripId != null) {
      const trip = tripMap.get(highlightTripId)
      if (trip?.departureLat != null && trip?.departureLng != null) {
        const [dLat, dLng] = toDisplayCoord(trip.departureLat, trip.departureLng)
        const m = L.marker([dLat, dLng], { icon: homeIcon(), zIndexOffset: 500 })
          .addTo(map).bindPopup(`<b>${trip.departureName || '出发地'}</b>`)
        layersRef.current.push(m)
      }
    }

    let spotIdx = 0
    for (const mk of markers) {
      const isHighlighted = highlightTripId == null || mk.tripId === highlightTripId
      let icon: L.DivIcon
      if (mk.isDeparture) {
        if (highlightTripId != null && mk.tripId === highlightTripId) continue
        icon = homeIcon()
      } else if (isHighlighted) {
        icon = spotPin(spotIdx, highlightTripId != null)
        spotIdx++
      } else {
        icon = dimDot()
      }
      const m = L.marker([mk.lat, mk.lng], { icon, zIndexOffset: isHighlighted ? 400 : 100 }).addTo(map)
      m.bindPopup(`<b>${mk.name}</b><br/>${mk.tripName}<br/>${mk.date}`)
      m.on('click', () => { onMarkerClick(mk); onTripClick?.(mk.tripId) })
      layersRef.current.push(m)
    }

    return () => { layersRef.current.forEach(l => map.removeLayer(l)); layersRef.current = [] }
  }, [markers, highlightTripId, tripMap, map, onMarkerClick, onTripClick])
  return null
}

// --------------- Real Route Polyline ---------------

/** Fetch and display real route between waypoints */
function RealRouteDisplay({ waypoints, color, weight, opacity, dashArray }: {
  waypoints: { lat: number; lng: number; transport?: TransportType }[]
  color: string; weight: number; opacity: number; dashArray?: string
}) {
  const [positions, setPositions] = useState<[number, number][]>([])

  // Stable dependency key
  const waypointsKey = useMemo(
    () => waypoints.map(w => `${w.lat.toFixed(5)},${w.lng.toFixed(5)},${w.transport ?? ''}`).join('|'),
    [waypoints],
  )

  useEffect(() => {
    if (waypoints.length < 2) { setPositions([]); return }
    let cancelled = false

    async function load() {
      const allPos: [number, number][] = []
      for (let i = 0; i < waypoints.length - 1; i++) {
        const from = waypoints[i]!
        const to = waypoints[i + 1]!
        const route = await fetchRoute(from, to, to.transport)
        if (cancelled) return
        if (route.length >= 2) {
          for (const [lat, lng] of route) {
            allPos.push(toDisplayCoord(lat, lng) as [number, number])
          }
        } else {
          // Fallback: bezier for curves, straight line for others
          if (usesCurve(to.transport)) {
            const fromD = toDisplayCoord(from.lat, from.lng) as [number, number]
            const toD = toDisplayCoord(to.lat, to.lng) as [number, number]
            allPos.push(...bezierPositions(fromD, toD, to.transport, 80))
          } else {
            allPos.push(toDisplayCoord(from.lat, from.lng) as [number, number])
            allPos.push(toDisplayCoord(to.lat, to.lng) as [number, number])
          }
        }
      }
      if (!cancelled) setPositions(allPos)
    }

    void load()
    return () => { cancelled = true }
  }, [waypointsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  if (positions.length < 2) return null
  return <Polyline positions={positions} pathOptions={{ color, weight, opacity, dashArray }} />
}

// --------------- Footprint Animator (real routes) ---------------

type AnimState = 'idle' | 'loading' | 'playing' | 'paused' | 'done'

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
    // Unified position array for current segment
    positions: [] as [number, number][],
    step: 0,
    stepsPerFrame: 1,
    lastDrawnIdx: 0,
    currentLine: null as L.Polyline | null,
    currentMover: null as L.Marker | null,
    rafId: null as number | null,
    timerId: null as ReturnType<typeof setTimeout> | null,
    started: false,
    fromLat: 0,
    fromLng: 0,
  })

  const cleanup = useCallback(() => {
    const s = ref.current
    if (s.rafId != null) cancelAnimationFrame(s.rafId)
    if (s.timerId != null) clearTimeout(s.timerId)
    s.rafId = null; s.timerId = null
    s.layers.forEach(l => map.removeLayer(l))
    s.layers = []; s.idx = 0; s.step = 0; s.started = false
    s.currentLine = null; s.currentMover = null; s.positions = []
  }, [map])

  useEffect(() => {
    const s = ref.current
    if (!playing) {
      if (s.rafId != null) { cancelAnimationFrame(s.rafId); s.rafId = null }
      if (s.timerId != null) { clearTimeout(s.timerId); s.timerId = null }
      return
    }
    if (!s.started) { cleanup(); s.started = true; showFirst() }
    else if (s.step > 0 && s.step < s.positions.length - 1) tick()
    else processNext()

    function showFirst() {
      if (markers.length === 0) { onDoneRef.current(); return }
      const m = markers[0]!
      const pos = L.latLng(m.lat, m.lng)
      map.flyTo(pos, Math.max(map.getZoom(), 10), { duration: 0.8 })
      s.timerId = setTimeout(() => {
        addPulse(pos)
        const cm = addArrivalMarker(m, pos)
        cm.openPopup()
        s.fromLat = m.lat; s.fromLng = m.lng; s.idx = 1
        s.timerId = setTimeout(() => { cm.closePopup(); processNext() }, 1500)
      }, 900)
    }

    function processNext() {
      const s = ref.current
      if (s.idx >= markers.length) {
        // All done — zoom out to show full footprint
        if (markers.length > 1) {
          map.flyToBounds(L.latLngBounds(markers.map(m => L.latLng(m.lat, m.lng))).pad(0.15), { duration: 1.2 })
        }
        s.timerId = setTimeout(() => onDoneRef.current(), 1400)
        return
      }
      const m = markers[s.idx]!
      const prev = markers[s.idx - 1]
      if (!prev || m.tripId !== prev.tripId) {
        // Different trip — fly to new location with appropriate zoom
        const to = L.latLng(m.lat, m.lng)
        map.flyTo(to, 12, { duration: 1.2 })
        s.timerId = setTimeout(() => {
          addPulse(to)
          const cm = addArrivalMarker(m, to)
          cm.openPopup()
          s.fromLat = m.lat; s.fromLng = m.lng; s.idx++
          s.timerId = setTimeout(() => { cm.closePopup(); processNext() }, 2000)
        }, 1300)
      } else {
        // Same trip — animate segment (fetch real route first)
        void startSegment(
          { lat: s.fromLat, lng: s.fromLng },
          { lat: m.lat, lng: m.lng },
          m,
        )
      }
    }

    /** Fetch route then start animating */
    async function startSegment(
      from: { lat: number; lng: number },
      to: { lat: number; lng: number },
      m: MarkerData,
    ) {
      const s = ref.current
      // Fetch real route (cached → instant)
      const route = await fetchRoute(from, to, m.transport)

      // Check if still playing after async
      if (!s.started) return

      // Build positions array (display coords)
      let positions: [number, number][]
      if (route.length >= 2) {
        // Real road route
        positions = route.map(([lat, lng]) =>
          toDisplayCoord(lat, lng) as [number, number],
        )
      } else {
        // Bezier curve fallback (plane, ship, or API failure)
        const fromD = toDisplayCoord(from.lat, from.lng) as [number, number]
        const toD = toDisplayCoord(to.lat, to.lng) as [number, number]
        positions = bezierPositions(fromD, toD, m.transport, 150)
      }

      s.positions = positions
      s.step = 0
      s.lastDrawnIdx = 0

      // Speed: aim for ~2-4 seconds per segment
      // 60fps * 3s = 180 frames target
      const targetFrames = Math.max(80, Math.min(240, positions.length))
      s.stepsPerFrame = Math.max(1, positions.length / targetFrames)

      // Instantly fit the segment bounds — no animation, no jitter
      const segBounds = L.latLngBounds(positions.map(p => L.latLng(p[0], p[1])))
      map.fitBounds(segBounds, { padding: [50, 50], maxZoom: 17, animate: false })

      // Create mover and line, start drawing
      const emoji = getTransportEmoji(m.transport)
      const icon = L.divIcon({
        className: '',
        html: `<span style="font-size:24px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35))">${emoji}</span>`,
        iconSize: [28, 28], iconAnchor: [14, 14],
      })
      const startPos = positions[0]!
      s.currentMover = L.marker([startPos[0], startPos[1]], { icon, zIndexOffset: 1000 }).addTo(map)
      s.layers.push(s.currentMover)
      s.currentLine = L.polyline([[startPos[0], startPos[1]]], {
        color: T.route, weight: 3.5, opacity: 0.85,
      }).addTo(map)
      s.layers.push(s.currentLine)

      tick()
    }

    /** Animate: advance through positions array */
    function tick() {
      const s = ref.current
      s.step += s.stepsPerFrame
      const idx = Math.min(Math.floor(s.step), s.positions.length - 1)
      const pos = s.positions[idx]!
      const latLng = L.latLng(pos[0], pos[1])

      // Draw all intermediate points to the line
      while (s.lastDrawnIdx < idx) {
        s.lastDrawnIdx++
        const p = s.positions[s.lastDrawnIdx]!
        s.currentLine!.addLatLng(L.latLng(p[0], p[1]))
      }

      s.currentMover!.setLatLng(latLng)

      if (idx < s.positions.length - 1) {
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
      const cm = addArrivalMarker(m, endPos)
      cm.openPopup()
      s.fromLat = m.lat; s.fromLng = m.lng; s.idx++; s.step = 0; s.positions = []
      const nextM = markers[s.idx]
      const delay = !nextM ? 2000 : nextM.tripId !== m.tripId ? 2000 : 1200
      s.timerId = setTimeout(() => { cm.closePopup(); processNext() }, delay)
    }

    function addPulse(pos: L.LatLng) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:16px;height:16px;border-radius:50%;background:${T.primary};opacity:0.7;animation:fpPulse 0.8s ease-out;box-shadow:0 0 8px ${T.primary}80"></div>`,
        iconSize: [16, 16], iconAnchor: [8, 8],
      })
      const p = L.marker(pos, { icon, zIndexOffset: 900 }).addTo(map)
      ref.current.layers.push(p)
      setTimeout(() => {
        map.removeLayer(p)
        const i = ref.current.layers.indexOf(p)
        if (i >= 0) ref.current.layers.splice(i, 1)
      }, 800)
    }

    function addArrivalMarker(m: MarkerData, pos: L.LatLng): L.CircleMarker {
      const cm = L.circleMarker(pos, {
        radius: 7, color: T.primary, fillColor: T.primary, fillOpacity: 0.85, weight: 2,
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

// --------------- Floating Spot Card (Glass) ---------------

function SpotCard({ marker, onClose, onClick }: {
  marker: MarkerData; onClose: () => void; onClick: () => void
}) {
  return (
    <div
      style={{
        position: 'absolute', bottom: 20, left: '50%',
        transform: 'translateX(-50%)', zIndex: 1000,
        width: 'min(400px, calc(100% - 32px))',
        ...T.glass, background: 'rgba(255,255,255,0.88)',
        borderRadius: 20,
        boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
        overflow: 'hidden', cursor: 'pointer',
        animation: 'spotCardSlideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
      onClick={onClick}
    >
      <div style={{ display: 'flex' }}>
        {marker.photo ? (
          <div style={{ width: 130, minHeight: 100, flexShrink: 0, position: 'relative' }}>
            <img src={marker.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent 60%, rgba(255,255,255,0.15))' }} />
          </div>
        ) : (
          <div style={{
            width: 100, minHeight: 100, flexShrink: 0,
            background: T.gradientLight,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 32, opacity: 0.4 }}>📍</span>
          </div>
        )}
        <div style={{ flex: 1, padding: '14px 16px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {marker.name}
          </div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {marker.tripName}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, background: T.primaryBg, color: T.primary, fontWeight: 600 }}>
              {marker.date}
            </span>
            {marker.address && (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, background: 'rgba(0,0,0,0.04)', color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                {marker.address}
              </span>
            )}
          </div>
        </div>
      </div>
      <div
        onClick={e => { e.stopPropagation(); onClose() }}
        style={{
          position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: '50%',
          background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.5)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.25)' }}
      >
        <CloseOutlined style={{ color: '#fff', fontSize: 10 }} />
      </div>
    </div>
  )
}

// --------------- Main component ---------------

export default function FootprintMap({ trips, spots, height = 480, spotCount, highlightTripId, onTripClick }: Props) {
  const [animState, setAnimState] = useState<AnimState>('idle')
  const [selectedMarker, setSelectedMarker] = useState<MarkerData | null>(null)

  useEffect(() => {
    if (highlightTripId != null) { setAnimState('idle'); setSelectedMarker(null) }
  }, [highlightTripId])

  const tripMap = useMemo(() => new Map(trips.map(t => [t.id, t])), [trips])

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
          photo: s.photos?.[0], address: s.address,
        })
        spotsByTrip.set(s.tripId, list)
      }
    }
    for (const list of spotsByTrip.values()) list.sort((a, b) => a.date.localeCompare(b.date))

    const sortedTrips = [...trips].sort((a, b) => a.startDate.localeCompare(b.startDate))
    const result: MarkerData[] = []
    for (const t of sortedTrips) {
      const ts = spotsByTrip.get(t.id!)
      if (ts && ts.length > 0) {
        if (t.departureLat != null && t.departureLng != null) {
          result.push({
            lat: t.departureLat, lng: t.departureLng,
            name: t.departureName ?? '出发地',
            tripName: t.title, date: t.startDate,
            tripId: t.id!, isDeparture: true, photo: t.coverPhoto,
          })
        }
        result.push(...ts)
      } else if (t.lat != null && t.lng != null) {
        result.push({
          lat: t.lat, lng: t.lng, name: t.destination,
          tripName: t.title, date: t.startDate,
          tripId: t.id!, photo: t.coverPhoto,
        })
      }
    }
    return result
  }, [trips, spots, tripMap])

  const displayMarkers = useMemo(
    () => markers.map(m => {
      const [lat, lng] = toDisplayCoord(m.lat, m.lng)
      return { ...m, lat, lng }
    }),
    [markers],
  )

  const displayCoords = useMemo<[number, number][]>(
    () => displayMarkers.map(m => [m.lat, m.lng]), [displayMarkers],
  )

  const fitCoords = useMemo<[number, number][]>(() => {
    if (highlightTripId != null) {
      const trip = tripMap.get(highlightTripId)
      const hc: [number, number][] = []
      if (trip?.departureLat != null && trip?.departureLng != null) {
        const [dLat, dLng] = toDisplayCoord(trip.departureLat, trip.departureLng)
        hc.push([dLat, dLng])
      }
      for (const m of displayMarkers) if (m.tripId === highlightTripId) hc.push([m.lat, m.lng])
      return hc.length > 0 ? hc : displayCoords
    }
    return displayCoords
  }, [highlightTripId, displayMarkers, displayCoords, tripMap])

  // Waypoints for highlighted trip's real route
  const highlightWaypoints = useMemo(() => {
    if (highlightTripId == null) return []
    const trip = tripMap.get(highlightTripId)
    const pts: { lat: number; lng: number; transport?: TransportType }[] = []
    if (trip?.departureLat != null && trip?.departureLng != null) {
      pts.push({ lat: trip.departureLat, lng: trip.departureLng })
    }
    // Use original WGS84 coords from markers (before display transform)
    for (const m of markers) {
      if (m.tripId === highlightTripId && !m.isDeparture) {
        pts.push({ lat: m.lat, lng: m.lng, transport: m.transport })
      }
    }
    return pts
  }, [highlightTripId, markers, tripMap])

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

  const showStatic = animState === 'idle'
  const handleMarkerClick = useCallback((m: MarkerData) => setSelectedMarker(m), [])

  return (
    <div style={{ position: 'relative', height, overflow: 'hidden' }}>
      <style>{`
        @keyframes fpPulse{0%{transform:scale(1);opacity:0.7}100%{transform:scale(3);opacity:0}}
        @keyframes spotCardSlideUp{0%{opacity:0;transform:translateX(-50%) translateY(16px)}100%{opacity:1;transform:translateX(-50%) translateY(0)}}
      `}</style>

      <MapContainer center={center} zoom={4} style={{ height: '100%', width: '100%' }} zoomControl={true}>
        <MapTiles />
        {fitCoords.length > 0 && <BoundsFitter coords={fitCoords} />}

        {/* Static pin markers */}
        {showStatic && (
          <StaticMarkers
            markers={displayMarkers}
            highlightTripId={highlightTripId}
            tripMap={tripMap}
            onMarkerClick={handleMarkerClick}
            onTripClick={onTripClick}
          />
        )}

        {/* Highlighted trip: real road route */}
        {showStatic && highlightWaypoints.length >= 2 && (
          <RealRouteDisplay
            waypoints={highlightWaypoints}
            color={T.route}
            weight={4}
            opacity={0.7}
            dashArray="10,8"
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

      {/* Play button — glass */}
      {highlightTripId == null && displayMarkers.length > 1 && (
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000 }}>
          <Button
            icon={
              animState === 'loading' ? <Spin indicator={<LoadingOutlined style={{ fontSize: 14, color: '#fff' }} />} /> :
              animState === 'playing' ? <PauseOutlined /> :
              animState === 'done' ? <ReloadOutlined /> :
              <PlayCircleOutlined />
            }
            onClick={handleButtonClick}
            disabled={animState === 'loading'}
            size="small"
            style={{
              ...T.glassButton,
              background: T.gradient,
              color: '#fff', border: 'none', fontWeight: 600,
              boxShadow: `0 4px 16px ${T.shadow}, inset 0 1px 0 rgba(255,255,255,0.2)`,
              height: 32, paddingInline: 14,
            }}
          >
            {animState === 'loading' ? '加载路线...' :
             animState === 'playing' ? '暂停' :
             animState === 'paused' ? '继续' :
             animState === 'done' ? '重播' : '播放足迹'}
          </Button>
        </div>
      )}

      {/* Spot count — glass badge */}
      {spotCount != null && !selectedMarker && (
        <div style={{
          position: 'absolute', bottom: 14, right: 14, zIndex: 1000,
          ...T.glassButton, fontSize: 12, color: T.text, padding: '5px 14px',
        }}>
          共 {spotCount} 个坐标点
        </div>
      )}

      {/* Floating spot card */}
      {selectedMarker && showStatic && (
        <SpotCard
          marker={selectedMarker}
          onClose={() => setSelectedMarker(null)}
          onClick={() => onTripClick?.(selectedMarker.tripId)}
        />
      )}
    </div>
  )
}
