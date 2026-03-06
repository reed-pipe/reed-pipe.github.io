import { encrypt, decrypt } from '../auth/crypto'
import { getGistIfModified, updateGistFiles } from './gist'
import { type AppDb } from '../db'

const CURRENT_SYNC_VERSION = 2

interface SyncPayload {
  syncVersion: number
  iv: string
  data: string
}

interface PlainData {
  lastModified: number
  tables: {
    kv: Array<{ key: string; value: unknown }>
    weightRecords: Array<Record<string, unknown>>
    bodyMeasurements?: Array<Record<string, unknown>>
    trips?: Array<Record<string, unknown>>
    tripSpots?: Array<Record<string, unknown>>
  }
}

interface BlobData {
  /** tripSpot id → photos base64[] */
  spotPhotos: Record<number, string[]>
  /** trip id → coverPhoto base64 */
  tripCovers: Record<number, string>
}

const HASH_KEY = 'pa_sync_hashes'

/** Simple fast hash for change detection (not cryptographic) */
function simpleHash(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return h.toString(36)
}

function getStoredHashes(): { data?: string; blob?: string } {
  try {
    return JSON.parse(localStorage.getItem(HASH_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function storeHashes(hashes: { data?: string; blob?: string }) {
  localStorage.setItem(HASH_KEY, JSON.stringify(hashes))
}

/** Strip photos/covers from records, return separate blob */
function splitBlobs(
  trips: Array<Record<string, unknown>>,
  tripSpots: Array<Record<string, unknown>>,
): { cleanTrips: Array<Record<string, unknown>>; cleanSpots: Array<Record<string, unknown>>; blob: BlobData } {
  const blob: BlobData = { spotPhotos: {}, tripCovers: {} }

  const cleanTrips = trips.map((t) => {
    const copy = { ...t }
    if (copy.coverPhoto) {
      blob.tripCovers[copy.id as number] = copy.coverPhoto as string
      delete copy.coverPhoto
    }
    return copy
  })

  const cleanSpots = tripSpots.map((s) => {
    const copy = { ...s }
    const photos = copy.photos as string[] | undefined
    if (photos && photos.length > 0) {
      blob.spotPhotos[copy.id as number] = photos
      copy.photos = []
    }
    return copy
  })

  return { cleanTrips, cleanSpots, blob }
}

/** Merge blobs back into records */
function mergeBlobs(
  trips: Array<Record<string, unknown>>,
  tripSpots: Array<Record<string, unknown>>,
  blob: BlobData | null,
): void {
  if (!blob) return
  for (const t of trips) {
    const cover = blob.tripCovers[t.id as number]
    if (cover) t.coverPhoto = cover
  }
  for (const s of tripSpots) {
    const photos = blob.spotPhotos[s.id as number]
    if (photos) s.photos = photos
  }
}


export async function pushData(
  db: AppDb,
  key: CryptoKey,
  dataGistId: string,
  username: string,
): Promise<void> {
  const [kvItems, weightRecords, bodyMeasurements, trips, tripSpots] = await Promise.all([
    db.kv.toArray(),
    db.weightRecords.toArray(),
    db.bodyMeasurements.toArray(),
    db.trips.toArray(),
    db.tripSpots.toArray(),
  ])

  const { cleanTrips, cleanSpots, blob } = splitBlobs(
    trips as unknown as Array<Record<string, unknown>>,
    tripSpots as unknown as Array<Record<string, unknown>>,
  )

  const plain: PlainData = {
    lastModified: Date.now(),
    tables: {
      kv: kvItems.map((item) => ({ key: item.key, value: item.value })),
      weightRecords: weightRecords as unknown as Array<Record<string, unknown>>,
      bodyMeasurements: bodyMeasurements as unknown as Array<Record<string, unknown>>,
      trips: cleanTrips,
      tripSpots: cleanSpots,
    },
  }

  const dataJson = JSON.stringify(plain)
  const blobJson = JSON.stringify(blob)

  const dataHash = simpleHash(dataJson)
  const blobHash = simpleHash(blobJson)
  const stored = getStoredHashes()

  const filesToUpdate: Record<string, string> = {}

  const dataFileName = `pa-data-${username}.json`
  const blobFileName = `pa-blob-${username}.json`

  if (dataHash !== stored.data) {
    const { iv, ciphertext } = await encrypt(dataJson, key)
    const payload: SyncPayload = { syncVersion: CURRENT_SYNC_VERSION, iv, data: ciphertext }
    filesToUpdate[dataFileName] = JSON.stringify(payload)
  }

  if (blobHash !== stored.blob) {
    const { iv, ciphertext } = await encrypt(blobJson, key)
    const payload: SyncPayload = { syncVersion: CURRENT_SYNC_VERSION, iv, data: ciphertext }
    filesToUpdate[blobFileName] = JSON.stringify(payload)
  }

  if (Object.keys(filesToUpdate).length === 0) {
    // Nothing changed
    return
  }

  await updateGistFiles(dataGistId, filesToUpdate)
  storeHashes({ data: dataHash, blob: blobHash })
}

export async function pullData(
  db: AppDb,
  key: CryptoKey,
  dataGistId: string,
): Promise<boolean> {
  const gist = await getGistIfModified(dataGistId)
  if (!gist) return false // 304 Not Modified — skip pull
  const files = gist.files
  const keys = Object.keys(files)

  // Find data file (supports both old and new format)
  const dataFileKey = keys.find((k) => k.startsWith('pa-data-')) ?? keys[0]
  if (!dataFileKey) throw new Error('Data gist has no files')

  const dataPayload: SyncPayload = JSON.parse(files[dataFileKey]!.content)
  if (!dataPayload.iv || !dataPayload.data) return false

  const plaintext = await decrypt(dataPayload.data, dataPayload.iv, key)
  const plain: PlainData = JSON.parse(plaintext)

  // Try to load blob file (new format)
  let blob: BlobData | null = null
  const blobFileKey = keys.find((k) => k.startsWith('pa-blob-'))
  if (blobFileKey) {
    try {
      const blobPayload: SyncPayload = JSON.parse(files[blobFileKey]!.content)
      if (blobPayload.iv && blobPayload.data) {
        const blobText = await decrypt(blobPayload.data, blobPayload.iv, key)
        blob = JSON.parse(blobText)
      }
    } catch { /* blob file missing or corrupt — continue without photos */ }
  }

  const tripsArr = (plain.tables.trips ?? []) as Array<Record<string, unknown>>
  const spotsArr = (plain.tables.tripSpots ?? []) as Array<Record<string, unknown>>

  // Merge photos/covers back if v2 split format
  mergeBlobs(tripsArr, spotsArr, blob)

  // For backward compat: old v1 data already has photos inline, mergeBlobs is a no-op

  await db.transaction('rw', [db.kv, db.weightRecords, db.bodyMeasurements, db.trips, db.tripSpots], async () => {
    await db.kv.clear()
    await db.weightRecords.clear()
    await db.bodyMeasurements.clear()
    await db.trips.clear()
    await db.tripSpots.clear()

    if (plain.tables.kv?.length) {
      await db.kv.bulkPut(plain.tables.kv)
    }
    if (plain.tables.weightRecords?.length) {
      await db.weightRecords.bulkPut(plain.tables.weightRecords as never[])
    }
    if (plain.tables.bodyMeasurements?.length) {
      await db.bodyMeasurements.bulkPut(plain.tables.bodyMeasurements as never[])
    }
    if (tripsArr.length) {
      await db.trips.bulkPut(tripsArr as never[])
    }
    if (spotsArr.length) {
      await db.tripSpots.bulkPut(spotsArr as never[])
    }
  })

  // Update local hashes so next push knows what's on cloud
  const dataHash = simpleHash(JSON.stringify(plain))
  const blobHash = blob ? simpleHash(JSON.stringify(blob)) : undefined
  storeHashes({ data: dataHash, blob: blobHash })

  return true
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

export function notifyDataChanged(
  db: AppDb,
  key: CryptoKey | null,
  dataGistId: string | null,
  username: string | null,
  onSyncStart: () => void,
  onSyncEnd: (error?: string) => void,
) {
  if (!key || !dataGistId || !username) return

  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    onSyncStart()
    try {
      await pushData(db, key, dataGistId, username)
      onSyncEnd()
    } catch (err) {
      onSyncEnd(err instanceof Error ? err.message : 'Push failed')
    }
  }, 3000)
}
