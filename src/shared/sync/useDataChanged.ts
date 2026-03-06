import { useCallback } from 'react'
import { useDb } from '../db/context'
import { useAuthStore } from '../auth/store'
import { useSyncStore } from './store'
import { notifyDataChanged } from './sync'

export function useDataChanged() {
  const db = useDb()
  const { cryptoKey, dataGistId, username } = useAuthStore()

  return useCallback(() => {
    const { setSyncing, setSynced, setError } = useSyncStore.getState()
    notifyDataChanged(db, cryptoKey, dataGistId, username, () => setSyncing(true), (err) => {
      if (err) setError(err)
      else setSynced()
    })
  }, [db, cryptoKey, dataGistId, username])
}
