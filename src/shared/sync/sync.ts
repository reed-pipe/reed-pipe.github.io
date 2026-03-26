import { encrypt, decrypt } from '../auth/crypto'
import { getGistIfModified, updateGistFiles } from './gist'
import { type AppDb, SYNCED_TABLES } from '../db'

const CURRENT_SYNC_VERSION = 3

interface SyncPayload {
  syncVersion: number
  iv: string
  data: string
}

interface PlainData {
  syncVersion: number
  lastModified: number
  tables: {
    kv: Array<{ key: string; value: unknown }>
    weightRecords: Array<Record<string, unknown>>
    bodyMeasurements?: Array<Record<string, unknown>>
    trips?: Array<Record<string, unknown>>
    tripSpots?: Array<Record<string, unknown>>
    ledgers?: Array<Record<string, unknown>>
    accCategories?: Array<Record<string, unknown>>
    accTransactions?: Array<Record<string, unknown>>
    accBudgets?: Array<Record<string, unknown>>
    accRecurring?: Array<Record<string, unknown>>
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

/** Prevent concurrent pushes */
let syncLock = false

/** Deep equality check for two plain values */
function recordsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Merge a single synced table (non-kv).
 * Compares remote records against local and applies merge rules.
 */
async function mergeTable(
  db: AppDb,
  tableName: string,
  remoteRecords: Record<string, unknown>[],
): Promise<void> {
  const table = db.table(tableName)
  const primaryKey = 'id'

  // Build lookup maps
  const remoteMap = new Map<unknown, Record<string, unknown>>()
  for (const r of remoteRecords) {
    remoteMap.set(r[primaryKey], r)
  }

  const localRecords = await table.toArray() as Record<string, unknown>[]
  const localMap = new Map<unknown, Record<string, unknown>>()
  for (const l of localRecords) {
    localMap.set(l[primaryKey], l)
  }

  // Process remote records
  for (const [rKey, remote] of remoteMap) {
    const local = localMap.get(rKey)

    if (!local) {
      // Remote has, local doesn't → add to local
      await table.add(remote as never)
      continue
    }

    // Both exist — check deletedAt
    if (remote.deletedAt != null) {
      // Remote marked deleted → mark local deleted too
      if (local.deletedAt == null || (local.deletedAt as number) !== (remote.deletedAt as number)) {
        await table.put({ ...local, deletedAt: remote.deletedAt, updatedAt: remote.updatedAt } as never)
      }
      continue
    }

    // Both exist, not deleted — compare updatedAt
    const remoteUpdated = (remote.updatedAt as number) ?? 0
    const localUpdated = (local.updatedAt as number) ?? 0

    if (remoteUpdated > localUpdated) {
      // Remote is newer → overwrite local
      await table.put(remote as never)
    } else if (remoteUpdated === localUpdated && !recordsEqual(remote, local)) {
      // Same timestamp but different content → conflict
      await db.syncConflicts.add({
        table: tableName,
        recordId: rKey as string | number,
        localData: local,
        remoteData: remote,
        status: 'pending',
        createdAt: Date.now(),
      } as never)
    }
    // localUpdated > remoteUpdated → keep local (will be pushed next)
  }

  // Local-only records (local has, remote doesn't) → keep local, will be pushed
  // No action needed
}

/**
 * Merge kv table using last-push-wins: remote always overwrites local.
 */
async function mergeKvTable(
  db: AppDb,
  remoteRecords: Array<{ key: string; value: unknown }>,
): Promise<void> {
  const remoteMap = new Map<string, { key: string; value: unknown }>()
  for (const r of remoteRecords) {
    remoteMap.set(r.key, r)
  }

  const localRecords = await db.kv.toArray()
  const localMap = new Map<string, { key: string; value: unknown }>()
  for (const l of localRecords) {
    localMap.set(l.key, l)
  }

  // Remote records: add or overwrite
  for (const [rKey, remote] of remoteMap) {
    const local = localMap.get(rKey)
    if (!local || !recordsEqual(local.value, remote.value)) {
      await db.kv.put(remote)
    }
  }

  // Local-only kv entries → keep local (will be pushed next)
}

/** Clean up soft-deleted records older than 30 days */
async function cleanupSoftDeletes(db: AppDb): Promise<void> {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  for (const tableName of SYNCED_TABLES) {
    const table = db.table(tableName)
    await table
      .where('deletedAt')
      .belowOrEqual(cutoff)
      .delete()
  }
}


export async function pushData(
  db: AppDb,
  key: CryptoKey,
  dataGistId: string,
  username: string,
): Promise<void> {
  if (syncLock) return
  syncLock = true
  try {
    // Pull-merge before push to avoid overwriting remote changes
    await pullData(db, key, dataGistId)

    const [kvItems, weightRecords, bodyMeasurements, trips, tripSpots, ledgers, accCategories, accTransactions, accBudgets, accRecurring] = await Promise.all([
      db.kv.toArray(),
      db.weightRecords.toArray(),
      db.bodyMeasurements.toArray(),
      db.trips.toArray(),
      db.tripSpots.toArray(),
      db.ledgers.toArray(),
      db.accCategories.toArray(),
      db.accTransactions.toArray(),
      db.accBudgets.toArray(),
      db.accRecurring.toArray(),
    ])

    const { cleanTrips, cleanSpots, blob } = splitBlobs(
      trips as unknown as Array<Record<string, unknown>>,
      tripSpots as unknown as Array<Record<string, unknown>>,
    )

    const plain: PlainData = {
      syncVersion: CURRENT_SYNC_VERSION,
      lastModified: Date.now(),
      tables: {
        kv: kvItems.map((item) => ({ key: item.key, value: item.value })),
        weightRecords: weightRecords as unknown as Array<Record<string, unknown>>,
        bodyMeasurements: bodyMeasurements as unknown as Array<Record<string, unknown>>,
        trips: cleanTrips,
        tripSpots: cleanSpots,
        ledgers: ledgers as unknown as Array<Record<string, unknown>>,
        accCategories: accCategories as unknown as Array<Record<string, unknown>>,
        accTransactions: accTransactions as unknown as Array<Record<string, unknown>>,
        accBudgets: accBudgets as unknown as Array<Record<string, unknown>>,
        accRecurring: accRecurring as unknown as Array<Record<string, unknown>>,
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

    // Clean up soft-deleted records older than 30 days after successful push
    await cleanupSoftDeletes(db)
  } finally {
    syncLock = false
  }
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

  // Merge photos/covers back if v2+ split format
  mergeBlobs(tripsArr, spotsArr, blob)

  // --- Merge-based pull (not clear-and-replace) ---

  // 1. Merge kv table (last-push-wins)
  if (plain.tables.kv?.length) {
    await mergeKvTable(db, plain.tables.kv)
  }

  // 2. Merge each synced table
  const tableDataMap: Record<string, Array<Record<string, unknown>>> = {
    weightRecords: plain.tables.weightRecords ?? [],
    bodyMeasurements: plain.tables.bodyMeasurements ?? [],
    trips: tripsArr,
    tripSpots: spotsArr,
    ledgers: plain.tables.ledgers ?? [],
    accCategories: plain.tables.accCategories ?? [],
    accTransactions: plain.tables.accTransactions ?? [],
    accBudgets: plain.tables.accBudgets ?? [],
    accRecurring: plain.tables.accRecurring ?? [],
  }

  for (const tableName of SYNCED_TABLES) {
    const remoteRecords = tableDataMap[tableName]
    if (remoteRecords) {
      await mergeTable(db, tableName, remoteRecords)
    }
  }

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
