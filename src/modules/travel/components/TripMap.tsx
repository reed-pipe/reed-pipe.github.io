import { useMemo } from 'react'
import { Empty, theme } from 'antd'
import type { TripSpot } from '@/shared/db'
import { sortSpots } from '../utils'

interface Props {
  spots: TripSpot[]
  height?: number
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

/**
 * 简易地图组件 — 使用 Leaflet CDN
 * 通过 iframe + srcdoc 避免在主 bundle 中引入 Leaflet 依赖
 */
export default function TripMap({ spots, height = 360 }: Props) {
  const { token: { colorPrimary } } = theme.useToken()

  const geoSpots = useMemo(
    () => sortSpots(spots).filter((s) => s.lat != null && s.lng != null),
    [spots],
  )

  if (geoSpots.length === 0) {
    return <Empty description="暂无坐标数据，添加打卡点时填写经纬度即可在地图上显示" style={{ padding: 32 }} />
  }

  // 计算中心和边界
  const lats = geoSpots.map((s) => s.lat!)
  const lngs = geoSpots.map((s) => s.lng!)
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2

  const markersJs = geoSpots
    .map(
      (s) =>
        `L.marker([${s.lat},${s.lng}]).addTo(map).bindPopup(\`<b>${s.name.replace(/`/g, "'")}</b><br/>${s.date}\`);
         coords.push([${s.lat},${s.lng}]);`,
    )
    .join('\n')

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>html,body,#map{margin:0;height:100%;width:100%}</style>
</head><body>
<div id="map"></div>
<script>
var map=L.map('map').setView([${centerLat},${centerLng}],6);
L.tileLayer('${TILE_URL}',{maxZoom:18,attribution:'OpenStreetMap'}).addTo(map);
var coords=[];
${markersJs}
if(coords.length>1){
  L.polyline(coords,{color:'${colorPrimary}',weight:2,opacity:0.7,dashArray:'6,4'}).addTo(map);
  map.fitBounds(L.latLngBounds(coords).pad(0.15));
}else if(coords.length===1){
  map.setView(coords[0],12);
}
<\/script>
</body></html>`

  return (
    <iframe
      srcDoc={html}
      style={{ width: '100%', height, border: 'none', borderRadius: 8 }}
      sandbox="allow-scripts"
      title="trip-map"
    />
  )
}
