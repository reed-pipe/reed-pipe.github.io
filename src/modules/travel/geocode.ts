import { wgs84ToGcj02, gcj02ToWgs84 } from './mapConfig'

const AMAP_KEY = 'c7919947b20cad7e272c7f3872425f0c'

// --------------- Search (POI) ---------------

export interface GeoSearchResult {
  name: string
  address: string
  lat: number // WGS84
  lng: number // WGS84
}

interface AmapPoi {
  name: string
  address: string
  location: string // "lng,lat" in GCJ-02
  pname: string
  cityname: string
  adname: string
}

export async function searchLocation(query: string): Promise<GeoSearchResult[]> {
  if (!query.trim()) return []
  const url = `https://restapi.amap.com/v3/place/text?key=${AMAP_KEY}&keywords=${encodeURIComponent(query)}&offset=6&extensions=base`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  if (data.status !== '1' || !data.pois) return []
  return (data.pois as AmapPoi[]).map((poi) => {
    const parts = poi.location.split(',')
    const [lat, lng] = gcj02ToWgs84(parseFloat(parts[1]!), parseFloat(parts[0]!))
    const addr = [poi.pname, poi.cityname, poi.adname, poi.address]
      .filter((s) => s && s !== '[]')
      .join('')
    return { name: poi.name, address: addr || poi.name, lat, lng }
  })
}

// --------------- Reverse Geocode ---------------

export interface ReverseGeoResult {
  name: string
  address: string
}

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeoResult | null> {
  const [gcjLat, gcjLng] = wgs84ToGcj02(lat, lng)
  const url = `https://restapi.amap.com/v3/geocode/regeo?key=${AMAP_KEY}&location=${gcjLng.toFixed(6)},${gcjLat.toFixed(6)}&extensions=all&radius=200&poitype=&roadlevel=0`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  if (data.status !== '1' || !data.regeocode) return null
  const addr = data.regeocode.formatted_address || ''
  const pois = data.regeocode.pois as { name: string }[] | undefined
  const comp = data.regeocode.addressComponent
  const name = pois?.[0]?.name
    || comp?.neighborhood?.name
    || comp?.building?.name
    || comp?.township
    || addr.split(/省|市|区|县/).pop()
    || addr
  return addr ? { name, address: addr } : null
}
