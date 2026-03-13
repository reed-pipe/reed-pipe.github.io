import { create } from 'zustand'
import type { AppDb } from '@/shared/db'

interface AccountingStore {
  defaultLedgerId: number | null
  noteHistory: string[]
  loaded: boolean
  load: (db: AppDb) => Promise<void>
  setDefaultLedgerId: (id: number | null, db: AppDb) => Promise<void>
  addNoteHistory: (note: string, db: AppDb) => Promise<void>
}

const MAX_NOTE_HISTORY = 20

export const useAccountingStore = create<AccountingStore>((set, get) => ({
  defaultLedgerId: null,
  noteHistory: [],
  loaded: false,

  async load(db) {
    const [ledger, notes] = await Promise.all([
      db.kv.get('accounting_default_ledger'),
      db.kv.get('accounting_note_history'),
    ])
    set({
      defaultLedgerId: (ledger?.value as number) ?? null,
      noteHistory: (notes?.value as string[]) ?? [],
      loaded: true,
    })
  },

  async setDefaultLedgerId(id, db) {
    if (id === null) {
      await db.kv.delete('accounting_default_ledger')
    } else {
      await db.kv.put({ key: 'accounting_default_ledger', value: id })
    }
    set({ defaultLedgerId: id })
  },

  async addNoteHistory(note, db) {
    if (!note.trim()) return
    const { noteHistory } = get()
    const filtered = noteHistory.filter(n => n !== note)
    const updated = [note, ...filtered].slice(0, MAX_NOTE_HISTORY)
    await db.kv.put({ key: 'accounting_note_history', value: updated })
    set({ noteHistory: updated })
  },
}))
