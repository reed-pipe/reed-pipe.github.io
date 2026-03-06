import { TileLayer } from 'react-leaflet'
import type { MapProvider } from '../mapConfig'

export default function MapTiles({ provider }: { provider: MapProvider }) {
  if (provider === 'amap') {
    return (
      <TileLayer
        url="https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}"
        maxZoom={18}
        subdomains={'1234'}
        attribution="&copy; 高德地图"
      />
    )
  }
  return (
    <TileLayer
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      maxZoom={18}
      attribution="OSM"
    />
  )
}
