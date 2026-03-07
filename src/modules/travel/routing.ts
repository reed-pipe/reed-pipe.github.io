import { wgs84ToGcj02, gcj02ToWgs84 } from './mapConfig'
import type { TransportType } from '@/shared/db'

const AMAP_KEY = 'c7919947b20cad7e272c7f3872425f0c'

// In-memory cache: key -> WGS84 [lat, lng][]
const cache = new Map<string, [number, number][]>()

function key(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  transport: string,
) {
  return `${from.lat.toFixed(5)},${from.lng.toFixed(5)}-${to.lat.toFixed(5)},${to.lng.toFixed(5)}-${transport}`
}

/** Plane and ship have no road route — use curve instead */
export function usesCurve(transport?: TransportType): boolean {
  return transport === 'plane' || transport === 'ship'
}

function amapEndpoint(transport?: TransportType): string {
  if (transport === 'walk') return 'v3/direction/walking'
  if (transport === 'bike') return 'v4/direction/bicycling'
  return 'v3/direction/driving'
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

  let polyStr = ''
  if (endpoint.startsWith('v4')) {
    const steps = data?.data?.paths?.[0]?.steps
    if (Array.isArray(steps)) polyStr = steps.map((s: { polyline: string }) => s.polyline).join(';')
  } else {
    const steps = data?.route?.paths?.[0]?.steps
    if (Array.isArray(steps)) polyStr = steps.map((s: { polyline: string }) => s.polyline).join(';')
  }

  if (!polyStr) return []

  // "lng,lat;lng,lat;..." GCJ-02 -> WGS84
  return polyStr.split(';').filter(Boolean).map(p => {
    const parts = p.split(',')
    const lng = parseFloat(parts[0]!)
    const lat = parseFloat(parts[1]!)
    return gcj02ToWgs84(lat, lng) as [number, number]
  })
}

/**
 * Fetch a real road route between two points.
 * Returns WGS84 [lat, lng][] or empty array if unavailable.
 */
export async function fetchRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  transport?: TransportType,
): Promise<[number, number][]> {
  if (usesCurve(transport)) return []

  const k = key(from, to, transport ?? 'other')
  const cached = cache.get(k)
  if (cached) return cached

  try {
    const route = await fetchAmap(from, to, transport)
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
