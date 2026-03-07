import { getMapProvider, wgs84ToGcj02, gcj02ToWgs84 } from './mapConfig'
import type { TransportType } from '@/shared/db'

const AMAP_KEY = 'c7919947b20cad7e272c7f3872425f0c'

// In-memory cache: key -> WGS84 [lat, lng][]
const cache = new Map<string, [number, number][]>()

function key(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  transport: string,
  provider: string,
) {
  return `${from.lat.toFixed(5)},${from.lng.toFixed(5)}-${to.lat.toFixed(5)},${to.lng.toFixed(5)}-${transport}-${provider}`
}

/** Plane and ship have no road route — use curve instead */
export function usesCurve(transport?: TransportType): boolean {
  return transport === 'plane' || transport === 'ship'
}

// --------------- OSRM (OpenStreetMap) ---------------

function osrmProfile(transport?: TransportType): string {
  if (transport === 'walk') return 'foot'
  if (transport === 'bike') return 'cycling'
  return 'driving' // car, bus, train, other
}

async function fetchOsrm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  transport?: TransportType,
): Promise<[number, number][]> {
  const profile = osrmProfile(transport)
  const url = `https://router.project-osrm.org/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  const coords: number[][] | undefined = data?.routes?.[0]?.geometry?.coordinates
  if (!Array.isArray(coords) || coords.length === 0) return []
  // GeoJSON [lng, lat] → [lat, lng]
  return coords.map(c => [c[1], c[0]] as [number, number])
}

// --------------- AMap (高德) ---------------

function amapEndpoint(transport?: TransportType): string {
  if (transport === 'walk') return 'v3/direction/walking'
  if (transport === 'bike') return 'v4/direction/bicycling'
  return 'v3/direction/driving' // car, bus, train, other
}

async function fetchAmap(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  transport?: TransportType,
): Promise<[number, number][]> {
  const endpoint = amapEndpoint(transport)
  const [fLat, fLng] = wgs84ToGcj02(from.lat, from.lng)
  const [tLat, tLng] = wgs84ToGcj02(to.lat, to.lng)

  const params = new URLSearchParams({
    key: AMAP_KEY,
    origin: `${fLng.toFixed(6)},${fLat.toFixed(6)}`,
    destination: `${tLng.toFixed(6)},${tLat.toFixed(6)}`,
  })
  const url = `https://restapi.amap.com/${endpoint}?${params}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()

  // Extract polyline string from response
  let polyStr = ''
  if (endpoint.startsWith('v4')) {
    // v4 bicycling: data.data.paths[0].steps[].polyline
    const steps = data?.data?.paths?.[0]?.steps
    if (Array.isArray(steps)) polyStr = steps.map((s: { polyline: string }) => s.polyline).join(';')
  } else {
    // v3 driving/walking: route.paths[0].steps[].polyline
    const steps = data?.route?.paths?.[0]?.steps
    if (Array.isArray(steps)) polyStr = steps.map((s: { polyline: string }) => s.polyline).join(';')
  }

  if (!polyStr) return []

  // "lng,lat;lng,lat;..." GCJ-02 → WGS84
  return polyStr.split(';').filter(Boolean).map(p => {
    const parts = p.split(',')
    const lng = parseFloat(parts[0]!)
    const lat = parseFloat(parts[1]!)
    return gcj02ToWgs84(lat, lng) as [number, number]
  })
}

// --------------- Public API ---------------

/**
 * Fetch a real road route between two points.
 * Returns WGS84 [lat, lng][] or empty array if unavailable.
 * Results are cached in memory.
 */
export async function fetchRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  transport?: TransportType,
): Promise<[number, number][]> {
  if (usesCurve(transport)) return []

  const provider = getMapProvider()
  const k = key(from, to, transport ?? 'other', provider)
  const cached = cache.get(k)
  if (cached) return cached

  try {
    const route = provider === 'amap'
      ? await fetchAmap(from, to, transport)
      : await fetchOsrm(from, to, transport)
    if (route.length >= 2) cache.set(k, route)
    return route
  } catch {
    return []
  }
}

/**
 * Fetch routes for multiple segments in parallel.
 */
export async function fetchRoutes(
  segments: { from: { lat: number; lng: number }; to: { lat: number; lng: number }; transport?: TransportType }[],
): Promise<[number, number][][]> {
  return Promise.all(segments.map(s => fetchRoute(s.from, s.to, s.transport)))
}
