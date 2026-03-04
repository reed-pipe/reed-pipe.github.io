import { create } from 'zustand'

interface SyncState {
  syncing: boolean
  lastSynced: number | null
  error: string | null

  setSyncing: (v: boolean) => void
  setSynced: () => void
  setError: (msg: string | null) => void
}

export const useSyncStore = create<SyncState>((set) => ({
  syncing: false,
  lastSynced: null,
  error: null,

  setSyncing(v) {
    set({ syncing: v, error: v ? null : undefined })
  },

  setSynced() {
    set({ syncing: false, lastSynced: Date.now(), error: null })
  },

  setError(msg) {
    set({ syncing: false, error: msg })
  },
}))
