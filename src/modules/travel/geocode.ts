import { getMapProvider, wgs84ToGcj02, gcj02ToWgs84 } from './mapConfig'

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

async function searchAmap(query: string): Promise<GeoSearchResult[]> {
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

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  name: string
}

async function searchNominatim(query: string): Promise<GeoSearchResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&accept-language=zh`
  const res = await fetch(url, { headers: { 'User-Agent': 'PersonalAssistant/1.0' } })
  if (!res.ok) return []
  const data: NominatimResult[] = await res.json()
  return data.map((item) => ({
    name: item.name || item.display_name.split(',')[0]!,
    address: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  }))
}

export async function searchLocation(query: string): Promise<GeoSearchResult[]> {
  if (!query.trim()) return []
  const provider = getMapProvider()
  if (provider === 'amap') return searchAmap(query)
  return searchNominatim(query)
}

// --------------- Reverse Geocode ---------------

export interface ReverseGeoResult {
  name: string   // short POI / place name
  address: string
}

async function reverseAmap(lat: number, lng: number): Promise<ReverseGeoResult | null> {
  const [gcjLat, gcjLng] = wgs84ToGcj02(lat, lng)
  const url = `https://restapi.amap.com/v3/geocode/regeo?key=${AMAP_KEY}&location=${gcjLng.toFixed(6)},${gcjLat.toFixed(6)}&extensions=all&radius=200&poitype=&roadlevel=0`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  if (data.status !== '1' || !data.regeocode) return null
  const addr = data.regeocode.formatted_address || ''
  // Try to get a meaningful short name from nearby POIs or address component
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

async function reverseNominatim(lat: number, lng: number): Promise<ReverseGeoResult | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh`,
    { headers: { 'User-Agent': 'PersonalAssistant/1.0' } },
  )
  if (!res.ok) return null
  const data = await res.json()
  if (!data.display_name) return null
  const name = data.name || data.display_name.split(',')[0] || data.display_name
  return { name, address: data.display_name }
}

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeoResult | null> {
  const provider = getMapProvider()
  if (provider === 'amap') return reverseAmap(lat, lng)
  return reverseNominatim(lat, lng)
}
