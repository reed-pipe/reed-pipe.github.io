import { useState, useRef, useCallback, useEffect } from 'react'
import { MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { Input, Spin, Typography, theme } from 'antd'
import { EnvironmentOutlined, SearchOutlined, AimOutlined } from '@ant-design/icons'
import { useMapProvider, toDisplayCoord, fromDisplayCoord } from '../mapConfig'
import { searchLocation, reverseGeocode, type GeoSearchResult } from '../geocode'
import MapTiles from './MapTiles'

const { Text } = Typography

export interface LocationValue {
  lat: number
  lng: number
  address: string
}

interface Props {
  value?: LocationValue | null
  onChange?: (value: LocationValue | null) => void
  compact?: boolean
  placeholder?: string
}

const pinIcon = (color: string) => L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;position:relative;top:-14px">
    <div style="width:20px;height:20px;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);margin:auto"></div>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
})

/** Map click handler for position adjustment */
function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

/** Recenter map when position changes */
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, map.getZoom())
  }, [map, center])
  return null
}

export default function LocationPicker({ value, onChange, compact, placeholder }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { token: { colorPrimary, colorBgElevated, colorBorder, borderRadiusLG, colorTextSecondary } } = theme.useToken()
  const [provider] = useMapProvider()

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSearch = useCallback((val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) {
      setResults([])
      setShowResults(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await searchLocation(val)
        setResults(res)
        setShowResults(res.length > 0)
      } finally {
        setSearching(false)
      }
    }, 500)
  }, [])

  const handleSelect = (item: GeoSearchResult) => {
    onChange?.({ lat: item.lat, lng: item.lng, address: item.address })
    setQuery(item.name)
    setShowResults(false)
    setResults([])
  }

  const handleClear = () => {
    onChange?.(null)
    setQuery('')
    setResults([])
  }

  const handleMapPick = useCallback((displayLat: number, displayLng: number) => {
    const [lat, lng] = fromDisplayCoord(displayLat, displayLng, provider)
    onChange?.({ lat, lng, address: value?.address ?? '' })
    reverseGeocode(lat, lng)
      .then((result) => {
        if (result?.address) {
          onChange?.({ lat, lng, address: result.address })
        }
      })
      .catch(() => {})
  }, [onChange, value?.address, provider])

  const displayCenter = value ? toDisplayCoord(value.lat, value.lng, provider) : null

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <Input
        placeholder={placeholder ?? '搜索地点名称（如：西湖、东京塔）'}
        prefix={<SearchOutlined style={{ color: colorTextSecondary }} />}
        suffix={searching ? <Spin size="small" /> : null}
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        onFocus={() => results.length > 0 && setShowResults(true)}
        allowClear
        onClear={handleClear}
      />

      {showResults && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1050,
            background: colorBgElevated,
            border: `1px solid ${colorBorder}`,
            borderRadius: borderRadiusLG,
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            maxHeight: 240,
            overflowY: 'auto',
            marginTop: 4,
          }}
        >
          {results.map((item, i) => (
            <div
              key={i}
              onClick={() => handleSelect(item)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: i < results.length - 1 ? `1px solid ${colorBorder}` : undefined,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <EnvironmentOutlined style={{ color: colorPrimary, fontSize: 13 }} />
                <Text strong style={{ fontSize: 13 }}>
                  {item.name}
                </Text>
              </div>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }} ellipsis>
                {item.address}
              </Text>
            </div>
          ))}
        </div>
      )}

      {value && compact && (
        <div style={{ marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
            <AimOutlined style={{ marginRight: 4 }} />
            {value.address || `${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}`}
          </Text>
        </div>
      )}

      {value && !compact && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <AimOutlined style={{ color: colorPrimary, fontSize: 12 }} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
            </Text>
          </div>
          {value.address && (
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }} ellipsis>
              {value.address}
            </Text>
          )}
          {displayCenter && (
            <div style={{ marginTop: 6, borderRadius: 8, overflow: 'hidden' }}>
              <MapContainer
                key={`${provider}-${displayCenter[0].toFixed(4)}-${displayCenter[1].toFixed(4)}`}
                center={displayCenter as [number, number]}
                zoom={14}
                style={{ height: 180, width: '100%', cursor: 'crosshair' }}
                zoomControl={false}
              >
                <MapTiles provider={provider} />
                <Marker position={displayCenter as [number, number]} icon={pinIcon(colorPrimary)} />
                <MapClickHandler onPick={handleMapPick} />
                <MapUpdater center={displayCenter as [number, number]} />
              </MapContainer>
              <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
                点击地图可微调位置
              </Text>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
