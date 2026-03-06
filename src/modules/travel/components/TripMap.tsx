import { useMemo, useRef, useCallback, useState, useEffect } from 'react'
import { Button, Empty, theme } from 'antd'
import { PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import type { Trip, TripSpot } from '@/shared/db'
import { sortSpots, getTransportEmoji } from '../utils'
import { useMapProvider, getTileLayerJs, toDisplayCoord } from '../mapConfig'

interface Props {
  trip: Trip
  spots: TripSpot[]
  height?: number
}

export default function TripMap({ trip, spots, height = 400 }: Props) {
  const { token: { colorPrimary } } = theme.useToken()
  const [provider] = useMapProvider()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [animating, setAnimating] = useState(false)
  const [hasPlayed, setHasPlayed] = useState(false)

  const sorted = useMemo(() => sortSpots(spots).filter((s) => s.lat != null && s.lng != null), [spots])

  const routePoints = useMemo(() => {
    const points: { lat: number; lng: number; name: string; emoji: string; isHome: boolean }[] = []
    if (trip.departureLat != null && trip.departureLng != null) {
      points.push({
        lat: trip.departureLat, lng: trip.departureLng,
        name: trip.departureName ?? '出发地', emoji: '🏠', isHome: true,
      })
    }
    for (const s of sorted) {
      points.push({
        lat: s.lat!, lng: s.lng!,
        name: s.name, emoji: getTransportEmoji(s.transport), isHome: false,
      })
    }
    return points
  }, [trip.departureLat, trip.departureLng, trip.departureName, sorted])

  // 监听 iframe 动画完成消息
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'animation-done') {
        setAnimating(false)
        setHasPlayed(true)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const playAnimation = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'play-animation' }, '*')
    setAnimating(true)
  }, [])

  if (routePoints.length === 0) {
    return <Empty description="暂无坐标数据，添加打卡点时搜索位置即可在地图上显示" style={{ padding: 32 }} />
  }

  const coordsJs = JSON.stringify(routePoints.map((p) => toDisplayCoord(p.lat, p.lng, provider)))

  const markersJs = routePoints.map((p, i) => {
    const label = p.isHome ? '🏠' : String(i)
    const size = p.isHome ? 28 : 22
    const safeName = JSON.stringify(p.name)
    const [dLat, dLng] = toDisplayCoord(p.lat, p.lng, provider)
    return `L.marker([${dLat},${dLng}],{icon:L.divIcon({className:'',html:'<div style="width:${size}px;height:${size}px;border-radius:50%;background:${p.isHome ? '#faad14' : colorPrimary};color:#fff;display:flex;align-items:center;justify-content:center;font-size:${p.isHome ? 16 : 12}px;font-weight:bold;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${label}</div>',iconSize:[${size},${size}],iconAnchor:[${size / 2},${size / 2}]})}).addTo(map).bindPopup('<b>'+${safeName}+'</b>');`
  }).join('\n')

  const segments: { from: [number, number]; to: [number, number]; emoji: string }[] = []
  for (let i = 0; i < routePoints.length - 1; i++) {
    const f = routePoints[i]!, t = routePoints[i + 1]!
    segments.push({ from: toDisplayCoord(f.lat, f.lng, provider), to: toDisplayCoord(t.lat, t.lng, provider), emoji: t.emoji })
  }
  const segmentsJson = JSON.stringify(segments)

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
html,body,#map{margin:0;height:100%;width:100%}
</style>
</head><body>
<div id="map"></div>
<script>
var map=L.map('map',{zoomControl:true});
${getTileLayerJs(provider)}.addTo(map);

var coords=${coordsJs};
var segments=${segmentsJson};

// Fit bounds
if(coords.length>1){
  map.fitBounds(L.latLngBounds(coords).pad(0.15));
}else if(coords.length===1){
  map.setView(coords[0],12);
}

// Add markers
${markersJs}

// Static route line (shown by default)
var staticLine=null;
if(coords.length>1){
  staticLine=L.polyline(coords,{color:'${colorPrimary}',weight:3,opacity:0.5,dashArray:'8,6'}).addTo(map);
}

// Animation state
var animLines=[];
var animMovers=[];

function clearAnimation(){
  for(var i=0;i<animLines.length;i++) map.removeLayer(animLines[i]);
  for(var i=0;i<animMovers.length;i++) map.removeLayer(animMovers[i]);
  animLines=[];
  animMovers=[];
}

function playAnimation(){
  clearAnimation();
  if(staticLine) map.removeLayer(staticLine);

  var segIdx=0;
  function animateSegment(){
    if(segIdx>=segments.length){
      // Done
      window.parent.postMessage({type:'animation-done'},'*');
      return;
    }
    var seg=segments[segIdx];
    var from=L.latLng(seg.from[0],seg.from[1]);
    var to=L.latLng(seg.to[0],seg.to[1]);

    // Distance-based step count: longer segments get more steps
    var dist=from.distanceTo(to);
    var steps=Math.max(30,Math.min(120,Math.round(dist/5000)));
    var dLat=(to.lat-from.lat)/steps;
    var dLng=(to.lng-from.lng)/steps;

    var icon=L.divIcon({className:'',html:'<span style="font-size:22px;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4))">'+seg.emoji+'</span>',iconSize:[28,28],iconAnchor:[14,14]});
    var mover=L.marker(from,{icon:icon,zIndexOffset:1000}).addTo(map);
    animMovers.push(mover);

    var line=L.polyline([from],{color:'${colorPrimary}',weight:3.5,opacity:0.9}).addTo(map);
    animLines.push(line);

    var step=0;
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
        var idx=animMovers.indexOf(mover);
        if(idx>=0) animMovers.splice(idx,1);
        segIdx++;
        animateSegment();
      }
    }
    requestAnimationFrame(tick);
  }
  animateSegment();
}

// Listen for play command from parent
window.addEventListener('message',function(e){
  if(e.data&&e.data.type==='play-animation'){
    playAnimation();
  }
});

// Notify parent that map is ready
map.whenReady(function(){
  window.parent.postMessage({type:'map-ready'},'*');
});
<\/script>
</body></html>`

  return (
    <div style={{ position: 'relative' }}>
      <iframe
        ref={iframeRef}
        srcDoc={html}
        style={{ width: '100%', height, border: 'none', borderRadius: 8 }}
        sandbox="allow-scripts"
        title="trip-map"
      />
      {/* 播放/重播按钮 */}
      {segments.length > 0 && (
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}>
          <Button
            type="primary"
            icon={hasPlayed ? <ReloadOutlined /> : <PlayCircleOutlined />}
            onClick={playAnimation}
            loading={animating}
            size="small"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
          >
            {animating ? '播放中' : hasPlayed ? '重播路线' : '播放路线'}
          </Button>
        </div>
      )}
    </div>
  )
}
