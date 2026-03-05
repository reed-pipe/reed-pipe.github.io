import { useMemo } from 'react'
import { Empty, theme } from 'antd'
import type { Trip, TripSpot } from '@/shared/db'

interface Props {
  trips: Trip[]
  spots: TripSpot[]
  height?: number
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

export default function FootprintMap({ trips, spots, height = 480 }: Props) {
  const { token: { colorPrimary } } = theme.useToken()

  const tripMap = useMemo(() => new Map(trips.map((t) => [t.id, t])), [trips])

  const geoSpots = useMemo(
    () => spots.filter((s) => s.lat != null && s.lng != null),
    [spots],
  )

  if (geoSpots.length === 0) {
    return <Empty description="暂无足迹坐标数据" style={{ padding: 40 }} />
  }

  const lats = geoSpots.map((s) => s.lat!)
  const lngs = geoSpots.map((s) => s.lng!)
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2

  const markersJs = geoSpots
    .map((s) => {
      const trip = tripMap.get(s.tripId)
      const tripName = (trip?.title ?? '').replace(/`/g, "'").replace(/\\/g, '')
      return `L.circleMarker([${s.lat},${s.lng}],{radius:6,color:'${colorPrimary}',fillColor:'${colorPrimary}',fillOpacity:0.7}).addTo(map).bindPopup(\`<b>${s.name.replace(/`/g, "'")}</b><br/>${tripName}<br/>${s.date}\`);`
    })
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
var map=L.map('map').setView([${centerLat},${centerLng}],4);
L.tileLayer('${TILE_URL}',{maxZoom:18,attribution:'OpenStreetMap'}).addTo(map);
${markersJs}
var bounds=L.latLngBounds([[${Math.min(...lats)},${Math.min(...lngs)}],[${Math.max(...lats)},${Math.max(...lngs)}]]);
map.fitBounds(bounds.pad(0.15));
<\/script>
</body></html>`

  return (
    <iframe
      srcDoc={html}
      style={{ width: '100%', height, border: 'none', borderRadius: 8 }}
      sandbox="allow-scripts"
      title="footprint-map"
    />
  )
}
