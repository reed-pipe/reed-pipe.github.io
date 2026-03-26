import { useCallback } from 'react'
import { useDb } from '../db/context'
import { useAuthStore } from '../auth/store'
import { useSyncStore } from './store'
import { notifyDataChanged } from './sync'

export function useDataChanged() {
  const db = useDb()
  const { cryptoKey, dataGistId, username } = useAuthStore()

  return useCallback(() => {
    if (!navigator.onLine) {
      // 离线：写入 syncQueue
      void db.syncQueue.add({
        action: 'update',
        table: '_batch',
        recordId: 0,
        data: null,
        createdAt: Date.now(),
      })
      return
    }
    // 在线：正常 debounced push
    if (!cryptoKey || !dataGistId || !username) return
    const { setSyncing, setSynced, setError } = useSyncStore.getState()
    notifyDataChanged(db, cryptoKey, dataGistId, username, () => setSyncing(true), (err) => {
      if (err) setError(err)
      else setSynced()
    })
  }, [db, cryptoKey, dataGistId, username])
}
