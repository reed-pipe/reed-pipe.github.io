import type { AppDb } from '@/shared/db'
import { pullData, pushData } from './sync'
import { useSyncStore } from './store'

/**
 * Flush offline sync queue by triggering a full pull-merge-push.
 * Called when the browser comes back online.
 */
export async function flushSyncQueue(
  db: AppDb,
  cryptoKey: CryptoKey,
  dataGistId: string,
  username: string,
): Promise<void> {
  const queueCount = await db.syncQueue.count()
  if (queueCount === 0) return

  const { setSyncing, setSynced, setError } = useSyncStore.getState()
  setSyncing(true)

  try {
    // Pull-merge-push cycle (same as online sync)
    await pullData(db, cryptoKey, dataGistId)
    await pushData(db, cryptoKey, dataGistId, username)

    // Clear the queue on success
    await db.syncQueue.clear()
    setSynced()
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Offline sync failed')
  }
}
