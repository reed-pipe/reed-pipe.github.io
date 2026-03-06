import { useMemo } from 'react'
import { Empty, theme } from 'antd'
import type { Trip, TripSpot } from '@/shared/db'
import { sortSpots, getTransportEmoji } from '../utils'

interface Props {
  trip: Trip
  spots: TripSpot[]
  height?: number
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

export default function TripMap({ trip, spots, height = 400 }: Props) {
  const { token: { colorPrimary } } = theme.useToken()

  const sorted = useMemo(() => sortSpots(spots).filter((s) => s.lat != null && s.lng != null), [spots])

  // 构建路线点：出发地 → 打卡点1 → 打卡点2 → ...
  const routePoints = useMemo(() => {
    const points: { lat: number; lng: number; name: string; emoji: string; isHome: boolean }[] = []

    // 出发地
    if (trip.departureLat != null && trip.departureLng != null) {
      points.push({
        lat: trip.departureLat,
        lng: trip.departureLng,
        name: trip.departureName ?? '出发地',
        emoji: '🏠',
        isHome: true,
      })
    }

    // 打卡点
    for (const s of sorted) {
      points.push({
        lat: s.lat!,
        lng: s.lng!,
        name: s.name,
        emoji: getTransportEmoji(s.transport),
        isHome: false,
      })
    }

    return points
  }, [trip, sorted])

  if (routePoints.length === 0) {
    return <Empty description="暂无坐标数据，添加打卡点时搜索位置即可在地图上显示" style={{ padding: 32 }} />
  }

  const lats = routePoints.map((p) => p.lat)
  const lngs = routePoints.map((p) => p.lng)
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2

  // 生成 segments JS：每段路线有自己的交通图标
  const segments: { from: typeof routePoints[0]; to: typeof routePoints[0] }[] = []
  for (let i = 0; i < routePoints.length - 1; i++) {
    segments.push({ from: routePoints[i]!, to: routePoints[i + 1]! })
  }

  const coordsJs = JSON.stringify(routePoints.map((p) => [p.lat, p.lng]))

  // 标记点 JS：出发地用 🏠，打卡点用序号
  const markersJs = routePoints.map((p, i) => {
    const label = p.isHome ? '🏠' : String(i)
    const size = p.isHome ? 28 : 22
    return `L.marker([${p.lat},${p.lng}],{icon:L.divIcon({className:'',html:'<div style="width:${size}px;height:${size}px;border-radius:50%;background:${p.isHome ? '#faad14' : colorPrimary};color:#fff;display:flex;align-items:center;justify-content:center;font-size:${p.isHome ? 16 : 12}px;font-weight:bold;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${label}</div>',iconSize:[${size},${size}],iconAnchor:[${size / 2},${size / 2}]})}).addTo(map).bindPopup('<b>${p.name.replace(/'/g, "\\'")}</b>');`
  }).join('\n')

  // 路线段信息（每段的交通 emoji）
  const segmentsJson = JSON.stringify(segments.map((seg) => ({
    from: [seg.from.lat, seg.from.lng],
    to: [seg.to.lat, seg.to.lng],
    emoji: seg.to.emoji,
  })))

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
html,body,#map{margin:0;height:100%;width:100%}
.transport-icon{font-size:20px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3))}
</style>
</head><body>
<div id="map"></div>
<script>
var map=L.map('map').setView([${centerLat},${centerLng}],6);
L.tileLayer('${TILE_URL}',{maxZoom:18,attribution:'OSM'}).addTo(map);

var coords=${coordsJs};
var segments=${segmentsJson};

// Fit bounds
if(coords.length>1){
  map.fitBounds(L.latLngBounds(coords).pad(0.15));
}else{
  map.setView(coords[0],12);
}

// Add markers
${markersJs}

// Animated route drawing + moving transport icon
function animateSegment(segIdx){
  if(segIdx>=segments.length)return;
  var seg=segments[segIdx];
  var from=L.latLng(seg.from[0],seg.from[1]);
  var to=L.latLng(seg.to[0],seg.to[1]);

  // Transport icon marker
  var icon=L.divIcon({className:'transport-icon',html:'<span>'+seg.emoji+'</span>',iconSize:[24,24],iconAnchor:[12,12]});
  var mover=L.marker(from,{icon:icon,zIndexOffset:1000}).addTo(map);

  // Animated polyline
  var line=L.polyline([from],{color:'${colorPrimary}',weight:3,opacity:0.8}).addTo(map);

  var steps=60;
  var step=0;
  var dLat=(to.lat-from.lat)/steps;
  var dLng=(to.lng-from.lng)/steps;

  function tick(){
    step++;
    var lat=from.lat+dLat*step;
    var lng=from.lng+dLng*step;
    var pos=L.latLng(lat,lng);
    line.addLatLng(pos);
    mover.setLatLng(pos);
    if(step<steps){
      requestAnimationFrame(tick);
    }else{
      map.removeLayer(mover);
      animateSegment(segIdx+1);
    }
  }
  requestAnimationFrame(tick);
}

// Start animation after a short delay
setTimeout(function(){animateSegment(0);},500);
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
