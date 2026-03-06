import { useState, useRef, useCallback, useEffect } from 'react'
import { Input, Spin, Typography, theme } from 'antd'
import { EnvironmentOutlined, SearchOutlined, AimOutlined } from '@ant-design/icons'
import { useMapProvider, getTileLayerJs, toDisplayCoord, fromDisplayCoord } from '../mapConfig'

const { Text } = Typography

export interface LocationValue {
  lat: number
  lng: number
  address: string
}

interface Props {
  value?: LocationValue | null
  onChange?: (value: LocationValue | null) => void
  /** 紧凑模式：不显示小地图和坐标详情，适合目的地选择 */
  compact?: boolean
  placeholder?: string
}

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  name: string
  type: string
}

/** Nominatim 搜索（防抖） */
async function searchLocation(query: string): Promise<NominatimResult[]> {
  if (!query.trim()) return []
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&accept-language=zh`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PersonalAssistant/1.0' },
  })
  if (!res.ok) return []
  return res.json()
}

export default function LocationPicker({ value, onChange, compact, placeholder }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { token: { colorPrimary, colorBgElevated, colorBorder, borderRadiusLG, colorTextSecondary } } = theme.useToken()
  const [provider] = useMapProvider()

  // 清理防抖定时器
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  // 点击外部关闭下拉
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

  const handleSelect = (item: NominatimResult) => {
    const loc: LocationValue = {
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      address: item.display_name,
    }
    onChange?.(loc)
    setQuery(item.name || item.display_name.split(',')[0]!)
    setShowResults(false)
    setResults([])
  }

  const handleClear = () => {
    onChange?.(null)
    setQuery('')
    setResults([])
  }

  // 地图点选的 iframe HTML
  const mapHtml = value
    ? (() => {
        const [dLat, dLng] = toDisplayCoord(value.lat, value.lng, provider)
        return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\\/script>
<style>html,body,#map{margin:0;height:100%;width:100%;cursor:crosshair}</style>
</head><body>
<div id="map"></div>
<script>
var map=L.map('map').setView([${dLat},${dLng}],14);
${getTileLayerJs(provider)}.addTo(map);
var marker=L.marker([${dLat},${dLng}]).addTo(map);
map.on('click',function(e){
  marker.setLatLng(e.latlng);
  window.parent.postMessage({type:'map-pick',lat:e.latlng.lat,lng:e.latlng.lng},'*');
});
<\\/script>
</body></html>`
      })()
    : null

  // 监听 iframe 消息（地图点选）
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'map-pick') {
        // 将显示坐标转换回 WGS-84 存储
        const [lat, lng] = fromDisplayCoord(e.data.lat, e.data.lng, provider)
        onChange?.({ lat, lng, address: value?.address ?? '' })
        // 异步获取地址名称（Nominatim 使用 WGS-84）
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh`, {
          headers: { 'User-Agent': 'PersonalAssistant/1.0' },
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.display_name) {
              onChange?.({ lat, lng, address: data.display_name })
            }
          })
          .catch(() => {})
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [onChange, value?.address, provider])

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      {/* 搜索框 */}
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

      {/* 搜索结果下拉 */}
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
                  {item.name || item.display_name.split(',')[0]}
                </Text>
              </div>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }} ellipsis>
                {item.display_name}
              </Text>
            </div>
          ))}
        </div>
      )}

      {/* 已选位置信息 */}
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
          {/* 小地图，可点击调整位置 */}
          {mapHtml && (
            <iframe
              srcDoc={mapHtml}
              style={{ width: '100%', height: 180, border: 'none', borderRadius: 8, marginTop: 6 }}
              sandbox="allow-scripts"
              title="location-picker"
            />
          )}
          <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
            点击地图可微调位置
          </Text>
        </div>
      )}
    </div>
  )
}
