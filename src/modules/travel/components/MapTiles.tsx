import { TileLayer } from 'react-leaflet'

export default function MapTiles() {
  return (
    <TileLayer
      url="https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}"
      maxZoom={18}
      subdomains={'1234'}
      attribution="&copy; 高德地图"
    />
  )
}
