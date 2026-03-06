import { useMemo, useRef, useCallback, useState, useEffect } from 'react'
import { Button, Empty, theme } from 'antd'
import { PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import type { Trip, TripSpot } from '@/shared/db'
import { useMapProvider, getTileLayerJs, toDisplayCoord } from '../mapConfig'

interface Props {
  trips: Trip[]
  spots: TripSpot[]
  height?: number
}

export default function FootprintMap({ trips, spots, height = 480 }: Props) {
  const { token: { colorPrimary } } = theme.useToken()
  const [provider] = useMapProvider()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [animating, setAnimating] = useState(false)
  const [hasPlayed, setHasPlayed] = useState(false)

  const tripMap = useMemo(() => new Map(trips.map((t) => [t.id, t])), [trips])

  // 合并坐标来源，并按日期排序，附带 tripId 用于分组连线
  const markers = useMemo(() => {
    const result: { lat: number; lng: number; name: string; tripName: string; date: string; tripId: number }[] = []

    for (const s of spots) {
      if (s.lat != null && s.lng != null) {
        const trip = tripMap.get(s.tripId)
        result.push({ lat: s.lat, lng: s.lng, name: s.name, tripName: trip?.title ?? '', date: s.date, tripId: s.tripId })
      }
    }

    const tripsWithSpotCoords = new Set(
      spots.filter((s) => s.lat != null && s.lng != null).map((s) => s.tripId),
    )
    for (const t of trips) {
      if (t.lat != null && t.lng != null && !tripsWithSpotCoords.has(t.id)) {
        result.push({ lat: t.lat, lng: t.lng, name: t.destination, tripName: t.title, date: t.startDate, tripId: t.id! })
      }
    }

    result.sort((a, b) => a.date.localeCompare(b.date))
    return result
  }, [trips, spots, tripMap])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'footprint-animation-done') {
        setAnimating(false)
        setHasPlayed(true)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const playAnimation = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'play-footprint-animation' }, '*')
    setAnimating(true)
  }, [])

  if (markers.length === 0) {
    return <Empty description="暂无足迹坐标数据" style={{ padding: 40 }} />
  }

  const displayCoords = markers.map((m) => toDisplayCoord(m.lat, m.lng, provider))
  const dLats = displayCoords.map((c) => c[0])
  const dLngs = displayCoords.map((c) => c[1])

  // 构建标记数据（传入 iframe）
  const markersData = markers.map((m, i) => {
    const [dLat, dLng] = displayCoords[i]!
    return { lat: dLat, lng: dLng, name: m.name, tripName: m.tripName, date: m.date, tripId: m.tripId }
  })
  const markersJson = JSON.stringify(markersData)

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\\/script>
<style>
html,body,#map{margin:0;height:100%;width:100%}
@keyframes pulse{0%{transform:scale(0);opacity:1}70%{transform:scale(2.5);opacity:0}100%{transform:scale(3);opacity:0}}
.pulse-ring{position:absolute;width:12px;height:12px;border-radius:50%;background:${colorPrimary};opacity:0.5;animation:pulse 0.6s ease-out;}
</style>
</head><body>
<div id="map"></div>
<script>
var map=L.map('map',{zoomControl:true});
${getTileLayerJs(provider)}.addTo(map);

var allMarkers=${markersJson};
var bounds=L.latLngBounds([[${Math.min(...dLats)},${Math.min(...dLngs)}],[${Math.max(...dLats)},${Math.max(...dLngs)}]]);
map.fitBounds(bounds.pad(0.15));

var staticLayers=[];
var animLayers=[];

function showStatic(){
  clearAnim();
  for(var i=0;i<staticLayers.length;i++) map.removeLayer(staticLayers[i]);
  staticLayers=[];
  for(var i=0;i<allMarkers.length;i++){
    var m=allMarkers[i];
    var cm=L.circleMarker([m.lat,m.lng],{radius:6,color:'${colorPrimary}',fillColor:'${colorPrimary}',fillOpacity:0.7})
      .addTo(map).bindPopup('<b>'+m.name+'</b><br/>'+m.tripName+'<br/>'+m.date);
    staticLayers.push(cm);
  }
}

function clearAnim(){
  for(var i=0;i<animLayers.length;i++) map.removeLayer(animLayers[i]);
  animLayers=[];
}

function playAnimation(){
  // 移除静态标记
  for(var i=0;i<staticLayers.length;i++) map.removeLayer(staticLayers[i]);
  staticLayers=[];
  clearAnim();

  var idx=0;
  var prevPos=null;
  var prevTripId=null;

  function showNext(){
    if(idx>=allMarkers.length){
      window.parent.postMessage({type:'footprint-animation-done'},'*');
      return;
    }
    var m=allMarkers[idx];
    var pos=L.latLng(m.lat,m.lng);

    // 同一旅行内画连线动画
    if(prevPos && m.tripId===prevTripId){
      var line=L.polyline([prevPos,pos],{color:'${colorPrimary}',weight:2.5,opacity:0.6,dashArray:'6,4'}).addTo(map);
      animLayers.push(line);
    }

    // 脉冲效果标记
    var pulseIcon=L.divIcon({className:'',html:'<div class="pulse-ring"></div>',iconSize:[12,12],iconAnchor:[6,6]});
    var pulseMarker=L.marker(pos,{icon:pulseIcon,zIndexOffset:900}).addTo(map);
    animLayers.push(pulseMarker);

    // 正式标记（延迟出现）
    setTimeout(function(){
      map.removeLayer(pulseMarker);
      var ii=animLayers.indexOf(pulseMarker);
      if(ii>=0) animLayers.splice(ii,1);

      var cm=L.circleMarker(pos,{radius:6,color:'${colorPrimary}',fillColor:'${colorPrimary}',fillOpacity:0.7})
        .addTo(map).bindPopup('<b>'+m.name+'</b><br/>'+m.tripName+'<br/>'+m.date);
      animLayers.push(cm);
    },300);

    prevPos=pos;
    prevTripId=m.tripId;
    idx++;

    // 间隔时间：同一旅行内快一些，不同旅行间慢一些
    var nextM=allMarkers[idx];
    var delay=(nextM && nextM.tripId!==m.tripId)?600:350;
    setTimeout(showNext,delay);
  }

  showNext();
}

// 初始显示静态标记
showStatic();

window.addEventListener('message',function(e){
  if(e.data&&e.data.type==='play-footprint-animation'){
    playAnimation();
  }
});

map.whenReady(function(){
  window.parent.postMessage({type:'footprint-map-ready'},'*');
});
<\\/script>
</body></html>`

  return (
    <div style={{ position: 'relative' }}>
      <iframe
        ref={iframeRef}
        srcDoc={html}
        style={{ width: '100%', height, border: 'none', borderRadius: 8 }}
        sandbox="allow-scripts"
        title="footprint-map"
      />
      {markers.length > 1 && (
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}>
          <Button
            type="primary"
            icon={hasPlayed ? <ReloadOutlined /> : <PlayCircleOutlined />}
            onClick={playAnimation}
            loading={animating}
            size="small"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
          >
            {animating ? '播放中' : hasPlayed ? '重播足迹' : '播放足迹'}
          </Button>
        </div>
      )}
    </div>
  )
}
