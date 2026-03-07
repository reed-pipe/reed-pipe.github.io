import { useMemo, useRef, useCallback, useState, useEffect } from 'react'
import { MapContainer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Button, Empty } from 'antd'
import { PlayCircleOutlined, ReloadOutlined, PauseOutlined } from '@ant-design/icons'
import type { Trip, TripSpot } from '@/shared/db'
import { sortSpots, getTransportEmoji, T } from '../utils'
import { toDisplayCoord } from '../mapConfig'
import { fetchRoute, usesCurve } from '../routing'
import MapTiles from './MapTiles'

interface Props {
  trip: Trip
  spots: TripSpot[]
  height?: number | string
}

function BoundsFitter({ coords }: { coords: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (coords.length > 1) map.fitBounds(L.latLngBounds(coords).pad(0.15))
    else if (coords.length === 1) map.setView(coords[0]!, 12)
    setTimeout(() => map.invalidateSize(), 100)
  }, [map, coords])
  return null
}

// --------------- Bezier fallback ---------------

function bezierPositions(
  from: [number, number], to: [number, number], steps = 80,
): [number, number][] {
  const midLat = (from[0] + to[0]) / 2
  const midLng = (from[1] + to[1]) / 2
  const dx = to[1] - from[1], dy = to[0] - from[0]
  const len = Math.sqrt(dx * dx + dy * dy)
  const factor = 0.25
  const offset = len * factor
  const ctrlLat = midLat + (len > 0.001 ? (-dx / len) * offset : 0)
  const ctrlLng = midLng + (len > 0.001 ? (dy / len) * offset : 0)

  const positions: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const mt = 1 - t
    positions.push([
      mt * mt * from[0] + 2 * mt * t * ctrlLat + t * t * to[0],
      mt * mt * from[1] + 2 * mt * t * ctrlLng + t * t * to[1],
    ])
  }
  return positions
}

// --------------- Real Route Display ---------------

function useRealRoutes(
  routePoints: { lat: number; lng: number; transport?: string; isHome: boolean }[],
) {
  const [segmentRoutes, setSegmentRoutes] = useState<[number, number][][]>([])

  const routeKey = useMemo(
    () => routePoints.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|'),
    [routePoints],
  )

  useEffect(() => {
    if (routePoints.length < 2) { setSegmentRoutes([]); return }
    let cancelled = false

    async function load() {
      const results: [number, number][][] = []
      for (let i = 0; i < routePoints.length - 1; i++) {
        const from = routePoints[i]!
        const to = routePoints[i + 1]!
        const transport = to.isHome ? undefined : (to.transport as import('@/shared/db').TransportType | undefined)
        const route = await fetchRoute(from, to, transport)
        if (cancelled) return

        if (route.length >= 2) {
          results.push(route.map(([lat, lng]) =>
            toDisplayCoord(lat, lng) as [number, number],
          ))
        } else if (usesCurve(transport)) {
          const fromD = toDisplayCoord(from.lat, from.lng) as [number, number]
          const toD = toDisplayCoord(to.lat, to.lng) as [number, number]
          results.push(bezierPositions(fromD, toD))
        } else {
          // Straight line fallback
          results.push([
            toDisplayCoord(from.lat, from.lng) as [number, number],
            toDisplayCoord(to.lat, to.lng) as [number, number],
          ])
        }
      }
      if (!cancelled) setSegmentRoutes(results)
    }

    void load()
    return () => { cancelled = true }
  }, [routeKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return segmentRoutes
}

// --------------- Route Animator (real routes) ---------------

function RouteAnimator({ segmentRoutes, playing, onDone }: {
  segmentRoutes: [number, number][][]
  playing: boolean
  onDone: () => void
}) {
  const map = useMap()
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const ref = useRef({
    layers: [] as L.Layer[],
    segIdx: 0,
    step: 0,
    stepsPerFrame: 1,
    lastDrawnIdx: 0,
    positions: [] as [number, number][],
    currentLine: null as L.Polyline | null,
    currentMover: null as L.Marker | null,
    rafId: null as number | null,
    started: false,
  })

  const cleanup = useCallback(() => {
    const s = ref.current
    if (s.rafId != null) cancelAnimationFrame(s.rafId)
    s.rafId = null
    s.layers.forEach(l => map.removeLayer(l))
    s.layers = []; s.segIdx = 0; s.step = 0; s.started = false
    s.currentLine = null; s.currentMover = null
  }, [map])

  useEffect(() => {
    const s = ref.current
    if (!playing) {
      if (s.rafId != null) { cancelAnimationFrame(s.rafId); s.rafId = null }
      return
    }
    if (!s.started) { cleanup(); s.started = true; startSegment() }
    else if (s.step > 0 && s.step < s.positions.length - 1) tick()
    else startSegment()

    function startSegment() {
      const s = ref.current
      if (s.segIdx >= segmentRoutes.length) {
        // Done: zoom out to show full route
        const allPos = segmentRoutes.flatMap(r => r)
        if (allPos.length > 1) {
          map.fitBounds(L.latLngBounds(allPos.map(p => L.latLng(p[0], p[1]))).pad(0.15), { animate: false })
        }
        onDoneRef.current()
        return
      }

      const positions = segmentRoutes[s.segIdx]!
      s.positions = positions
      s.step = 0; s.lastDrawnIdx = 0
      const targetFrames = Math.max(40, Math.min(150, positions.length))
      s.stepsPerFrame = Math.max(1, positions.length / targetFrames)

      // Instantly fit the segment bounds — no animation, no jitter
      const segBounds = L.latLngBounds(positions.map(p => L.latLng(p[0], p[1])))
      map.fitBounds(segBounds, { padding: [50, 50], maxZoom: 17, animate: false })

      const icon = L.divIcon({
        className: '',
        html: `<span style="font-size:22px;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4))">🚗</span>`,
        iconSize: [28, 28], iconAnchor: [14, 14],
      })
      const start = positions[0]!
      s.currentMover = L.marker([start[0], start[1]], { icon, zIndexOffset: 1000 }).addTo(map)
      s.layers.push(s.currentMover)
      s.currentLine = L.polyline([[start[0], start[1]]], { color: T.route, weight: 3.5, opacity: 0.9 }).addTo(map)
      s.layers.push(s.currentLine)
      tick()
    }

    function tick() {
      const s = ref.current
      s.step += s.stepsPerFrame
      const idx = Math.min(Math.floor(s.step), s.positions.length - 1)
      const pos = s.positions[idx]!

      while (s.lastDrawnIdx < idx) {
        s.lastDrawnIdx++
        const p = s.positions[s.lastDrawnIdx]!
        s.currentLine!.addLatLng(L.latLng(p[0], p[1]))
      }

      s.currentMover!.setLatLng(L.latLng(pos[0], pos[1]))

      if (idx < s.positions.length - 1) {
        s.rafId = requestAnimationFrame(tick)
      } else {
        // Remove mover, advance segment
        if (s.currentMover) {
          map.removeLayer(s.currentMover)
          const mi = s.layers.indexOf(s.currentMover)
          if (mi >= 0) s.layers.splice(mi, 1)
          s.currentMover = null
        }
        s.segIdx++; s.step = 0
        startSegment()
      }
    }

    return () => {
      const s = ref.current
      if (s.rafId != null) { cancelAnimationFrame(s.rafId); s.rafId = null }
    }
  }, [playing]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => cleanup, [cleanup])
  return null
}

// --------------- Pin icons ---------------

function makeIcon(label: string, isHome: boolean): L.DivIcon {
  const sz = isHome ? 32 : 28
  const bg = isHome ? 'linear-gradient(135deg, #faad14, #ffc53d)' : T.gradient
  const shadow = isHome ? '0 3px 10px rgba(250,173,20,0.4)' : `0 3px 10px ${T.shadow}`
  const fs = isHome ? 15 : 11
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:${sz}px;height:${sz + 8}px;filter:drop-shadow(${shadow})">
      <div style="
        width:${sz}px;height:${sz}px;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        background:${bg};
        border:2.5px solid rgba(255,255,255,0.9);
        box-shadow:inset 0 -2px 4px rgba(0,0,0,0.15), inset 0 2px 4px rgba(255,255,255,0.3);
        display:flex;align-items:center;justify-content:center;
      ">
        <span style="transform:rotate(45deg);color:#fff;font-size:${fs}px;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,0.2)">${label}</span>
      </div>
    </div>`,
    iconSize: [sz, sz + 8],
    iconAnchor: [sz / 2, sz + 8],
  })
}

// --------------- Main component ---------------

export default function TripMap({ trip, spots, height = 400 }: Props) {
  const [animState, setAnimState] = useState<'idle' | 'playing' | 'paused' | 'done'>('idle')

  const sorted = useMemo(() => sortSpots(spots).filter(s => s.lat != null && s.lng != null), [spots])

  const routePoints = useMemo(() => {
    const points: { lat: number; lng: number; name: string; emoji: string; isHome: boolean; transport?: string }[] = []
    if (trip.departureLat != null && trip.departureLng != null) {
      points.push({ lat: trip.departureLat, lng: trip.departureLng, name: trip.departureName ?? '出发地', emoji: '🏠', isHome: true })
    }
    for (const s of sorted) {
      points.push({ lat: s.lat!, lng: s.lng!, name: s.name, emoji: getTransportEmoji(s.transport), isHome: false, transport: s.transport })
    }
    return points
  }, [trip.departureLat, trip.departureLng, trip.departureName, sorted])

  const displayPoints = useMemo(
    () => routePoints.map(p => {
      const [lat, lng] = toDisplayCoord(p.lat, p.lng)
      return { ...p, dLat: lat, dLng: lng }
    }),
    [routePoints],
  )

  const displayCoords = useMemo<[number, number][]>(
    () => displayPoints.map(p => [p.dLat, p.dLng]), [displayPoints],
  )

  // Fetch real routes
  const segmentRoutes = useRealRoutes(routePoints)

  // Flatten all segment routes into one polyline for static display
  const fullRoute = useMemo(() => segmentRoutes.flatMap(r => r), [segmentRoutes])

  if (routePoints.length === 0) {
    return <Empty description="暂无坐标数据，添加打卡点时搜索位置即可在地图上显示" style={{ padding: 32 }} />
  }

  const center: [number, number] = [
    displayCoords.reduce((s, c) => s + c[0], 0) / displayCoords.length,
    displayCoords.reduce((s, c) => s + c[1], 0) / displayCoords.length,
  ]

  const handleButtonClick = () => {
    if (animState === 'idle' || animState === 'done') setAnimState('playing')
    else if (animState === 'playing') setAnimState('paused')
    else if (animState === 'paused') setAnimState('playing')
  }

  return (
    <div style={{ position: 'relative' }}>
      <MapContainer
        center={center}
        zoom={12}
        style={{ height, width: '100%', borderRadius: 12 }}
        zoomControl={true}
      >
        <MapTiles />
        <BoundsFitter coords={displayCoords} />

        {/* Pin markers */}
        {displayPoints.map((p, i) => (
          <Marker
            key={i}
            position={[p.dLat, p.dLng]}
            icon={makeIcon(p.isHome ? '🏠' : String(i), p.isHome)}
          >
            <Popup><b>{p.name}</b></Popup>
          </Marker>
        ))}

        {/* Static real route (idle / done) */}
        {(animState === 'idle' || animState === 'done') && fullRoute.length > 1 && (
          <Polyline
            positions={fullRoute}
            pathOptions={{ color: T.route, weight: 4, opacity: 0.7, dashArray: '10,8' }}
          />
        )}

        {/* Animation layer */}
        {(animState === 'playing' || animState === 'paused') && segmentRoutes.length > 0 && (
          <RouteAnimator
            segmentRoutes={segmentRoutes}
            playing={animState === 'playing'}
            onDone={() => setAnimState('done')}
          />
        )}
      </MapContainer>

      {/* Play/Pause button */}
      {segmentRoutes.length > 0 && (
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }}>
          <Button
            icon={
              animState === 'playing' ? <PauseOutlined /> :
              animState === 'done' ? <ReloadOutlined /> :
              <PlayCircleOutlined />
            }
            onClick={handleButtonClick}
            size="small"
            style={{
              ...T.glassButton,
              background: T.gradient,
              color: '#fff', border: 'none', fontWeight: 600,
              boxShadow: `0 3px 12px ${T.shadow}, inset 0 1px 0 rgba(255,255,255,0.2)`,
              height: 30, paddingInline: 12,
            }}
          >
            {animState === 'playing' ? '暂停' : animState === 'paused' ? '继续' : animState === 'done' ? '重播路线' : '播放路线'}
          </Button>
        </div>
      )}
    </div>
  )
}
