import { encrypt, decrypt } from '../auth/crypto'
import { getGist, updateGist } from './gist'
import { type AppDb } from '../db'

const CURRENT_SYNC_VERSION = 1

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
  }
}

export async function pushData(
  db: AppDb,
  key: CryptoKey,
  dataGistId: string,
): Promise<void> {
  const [kvItems, weightRecords] = await Promise.all([
    db.kv.toArray(),
    db.weightRecords.toArray(),
  ])

  const plain: PlainData = {
    lastModified: Date.now(),
    tables: {
      kv: kvItems.map((item) => ({ key: item.key, value: item.value })),
      weightRecords: weightRecords as unknown as Array<Record<string, unknown>>,
    },
  }

  const plaintext = JSON.stringify(plain)
  const { iv, ciphertext } = await encrypt(plaintext, key)

  const payload: SyncPayload = {
    syncVersion: CURRENT_SYNC_VERSION,
    iv,
    data: ciphertext,
  }

  // Find the filename in the gist
  const gist = await getGist(dataGistId)
  const filename = Object.keys(gist.files)[0]
  if (!filename) throw new Error('Data gist has no files')

  await updateGist(dataGistId, filename, JSON.stringify(payload))
}

export async function pullData(
  db: AppDb,
  key: CryptoKey,
  dataGistId: string,
): Promise<boolean> {
  const gist = await getGist(dataGistId)
  const file = Object.values(gist.files)[0]
  if (!file) throw new Error('Data gist has no files')

  const payload: SyncPayload = JSON.parse(file.content)

  // Empty data gist (newly registered)
  if (!payload.iv || !payload.data) return false

  const plaintext = await decrypt(payload.data, payload.iv, key)
  const plain: PlainData = JSON.parse(plaintext)

  // Clear local and write remote data
  await db.transaction('rw', db.kv, db.weightRecords, async () => {
    await db.kv.clear()
    await db.weightRecords.clear()

    if (plain.tables.kv?.length) {
      await db.kv.bulkPut(plain.tables.kv)
    }
    if (plain.tables.weightRecords?.length) {
      await db.weightRecords.bulkPut(plain.tables.weightRecords as never[])
    }
  })

  return true
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

export function notifyDataChanged(
  db: AppDb,
  key: CryptoKey | null,
  dataGistId: string | null,
  onSyncStart: () => void,
  onSyncEnd: (error?: string) => void,
) {
  if (!key || !dataGistId) return

  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    onSyncStart()
    try {
      await pushData(db, key, dataGistId)
      onSyncEnd()
    } catch (err) {
      onSyncEnd(err instanceof Error ? err.message : 'Push failed')
    }
  }, 3000)
}
