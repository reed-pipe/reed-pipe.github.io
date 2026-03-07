import { useMemo, useRef, useCallback, useState, useEffect } from 'react'
import { MapContainer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Button, Empty } from 'antd'
import { PlayCircleOutlined, ReloadOutlined, PauseOutlined } from '@ant-design/icons'
import type { Trip, TripSpot } from '@/shared/db'
import { sortSpots, getTransportEmoji, T } from '../utils'
import { useMapProvider, toDisplayCoord } from '../mapConfig'
import MapTiles from './MapTiles'

interface Props {
  trip: Trip
  spots: TripSpot[]
  height?: number | string
}

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

/** Route animation controller — uses imperative Leaflet API */
function RouteAnimator({ segments, playing, colorPrimary, onDone }: {
  segments: { from: [number, number]; to: [number, number]; emoji: string }[]
  playing: boolean
  colorPrimary: string
  onDone: () => void
}) {
  const map = useMap()
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const ref = useRef({
    lines: [] as L.Polyline[],
    movers: [] as L.Marker[],
    segIdx: 0,
    step: 0,
    totalSteps: 0,
    dLat: 0,
    dLng: 0,
    from: null as L.LatLng | null,
    currentLine: null as L.Polyline | null,
    currentMover: null as L.Marker | null,
    rafId: null as number | null,
    started: false,
  })

  const cleanup = useCallback(() => {
    const s = ref.current
    if (s.rafId != null) cancelAnimationFrame(s.rafId)
    s.rafId = null
    s.lines.forEach((l) => map.removeLayer(l))
    s.movers.forEach((m) => map.removeLayer(m))
    s.lines = []
    s.movers = []
    s.segIdx = 0
    s.step = 0
    s.started = false
    s.currentLine = null
    s.currentMover = null
  }, [map])

  useEffect(() => {
    const s = ref.current

    if (!playing) {
      // Pause: stop RAF
      if (s.rafId != null) { cancelAnimationFrame(s.rafId); s.rafId = null }
      return
    }

    // Playing
    if (!s.started) {
      cleanup()
      s.started = true
      animateSegment()
    } else {
      // Resume from pause
      if (s.step > 0 && s.step < s.totalSteps) {
        tick()
      } else {
        animateSegment()
      }
    }

    function animateSegment() {
      const s = ref.current
      if (s.segIdx >= segments.length) {
        onDoneRef.current()
        return
      }
      const seg = segments[s.segIdx]!
      const from = L.latLng(seg.from[0], seg.from[1])
      const to = L.latLng(seg.to[0], seg.to[1])
      const dist = from.distanceTo(to)
      s.totalSteps = Math.max(30, Math.min(120, Math.round(dist / 5000)))
      s.dLat = (to.lat - from.lat) / s.totalSteps
      s.dLng = (to.lng - from.lng) / s.totalSteps
      s.from = from
      s.step = 0

      const icon = L.divIcon({
        className: '',
        html: `<span style="font-size:22px;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4))">${seg.emoji}</span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })
      s.currentMover = L.marker(from, { icon, zIndexOffset: 1000 }).addTo(map)
      s.movers.push(s.currentMover)
      s.currentLine = L.polyline([from], { color: colorPrimary, weight: 3.5, opacity: 0.9 }).addTo(map)
      s.lines.push(s.currentLine)
      tick()
    }

    function tick() {
      const s = ref.current
      s.step++
      const lat = s.from!.lat + s.dLat * s.step
      const lng = s.from!.lng + s.dLng * s.step
      const pos = L.latLng(lat, lng)
      s.currentLine!.addLatLng(pos)
      s.currentMover!.setLatLng(pos)
      if (s.step < s.totalSteps) {
        s.rafId = requestAnimationFrame(tick)
      } else {
        map.removeLayer(s.currentMover!)
        const idx = s.movers.indexOf(s.currentMover!)
        if (idx >= 0) s.movers.splice(idx, 1)
        s.currentMover = null
        s.segIdx++
        s.step = 0
        animateSegment()
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

function makeIcon(label: string, size: number, bg: string, fontSize: number): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};color:#fff;display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;font-weight:bold;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export default function TripMap({ trip, spots, height = 400 }: Props) {
  const [provider] = useMapProvider()
  const [animState, setAnimState] = useState<'idle' | 'playing' | 'paused' | 'done'>('idle')
  const colorPrimary = T.primary

  const sorted = useMemo(() => sortSpots(spots).filter((s) => s.lat != null && s.lng != null), [spots])

  const routePoints = useMemo(() => {
    const points: { lat: number; lng: number; name: string; emoji: string; isHome: boolean }[] = []
    if (trip.departureLat != null && trip.departureLng != null) {
      points.push({ lat: trip.departureLat, lng: trip.departureLng, name: trip.departureName ?? '出发地', emoji: '🏠', isHome: true })
    }
    for (const s of sorted) {
      points.push({ lat: s.lat!, lng: s.lng!, name: s.name, emoji: getTransportEmoji(s.transport), isHome: false })
    }
    return points
  }, [trip.departureLat, trip.departureLng, trip.departureName, sorted])

  const displayPoints = useMemo(
    () => routePoints.map((p) => {
      const [lat, lng] = toDisplayCoord(p.lat, p.lng, provider)
      return { ...p, dLat: lat, dLng: lng }
    }),
    [routePoints, provider],
  )

  const displayCoords = useMemo<[number, number][]>(
    () => displayPoints.map((p) => [p.dLat, p.dLng]),
    [displayPoints],
  )

  const segments = useMemo(() => {
    const segs: { from: [number, number]; to: [number, number]; emoji: string }[] = []
    for (let i = 0; i < displayPoints.length - 1; i++) {
      const f = displayPoints[i]!, t = displayPoints[i + 1]!
      segs.push({ from: [f.dLat, f.dLng], to: [t.dLat, t.dLng], emoji: t.emoji })
    }
    return segs
  }, [displayPoints])

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
        key={provider}
        center={center}
        zoom={12}
        style={{ height, width: '100%', borderRadius: 8 }}
        zoomControl={true}
      >
        <MapTiles provider={provider} />
        <BoundsFitter coords={displayCoords} />

        {/* Markers */}
        {displayPoints.map((p, i) => (
          <Marker
            key={i}
            position={[p.dLat, p.dLng]}
            icon={makeIcon(
              p.isHome ? '🏠' : String(i),
              p.isHome ? 28 : 22,
              p.isHome ? '#faad14' : colorPrimary,
              p.isHome ? 16 : 12,
            )}
          >
            <Popup><b>{p.name}</b></Popup>
          </Marker>
        ))}

        {/* Static route line (idle only) */}
        {animState === 'idle' && displayCoords.length > 1 && (
          <Polyline
            positions={displayCoords}
            pathOptions={{ color: colorPrimary, weight: 3, opacity: 0.5, dashArray: '8,6' }}
          />
        )}

        {/* Animation layer */}
        {(animState === 'playing' || animState === 'paused') && (
          <RouteAnimator
            segments={segments}
            playing={animState === 'playing'}
            colorPrimary={colorPrimary}
            onDone={() => setAnimState('done')}
          />
        )}
      </MapContainer>

      {/* Play/Pause button */}
      {segments.length > 0 && (
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }}>
          <Button
            type="primary"
            icon={
              animState === 'playing' ? <PauseOutlined /> :
              animState === 'done' ? <ReloadOutlined /> :
              animState === 'paused' ? <PlayCircleOutlined /> :
              <PlayCircleOutlined />
            }
            onClick={handleButtonClick}
            size="small"
            style={{
              background: T.primary,
              borderColor: T.primary,
              color: '#fff',
              boxShadow: `0 2px 8px ${T.shadow}`,
            }}
          >
            {animState === 'playing' ? '暂停' : animState === 'paused' ? '继续' : animState === 'done' ? '重播路线' : '播放路线'}
          </Button>
        </div>
      )}
    </div>
  )
}
