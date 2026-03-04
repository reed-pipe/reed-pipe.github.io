import { create } from 'zustand'
import type { AppDb } from '@/shared/db'

interface BodyStore {
  height: number | null // cm
  goalWeight: number | null // kg
  loaded: boolean
  load: (db: AppDb) => Promise<void>
  setHeight: (v: number | null, db: AppDb) => Promise<void>
  setGoalWeight: (v: number | null, db: AppDb) => Promise<void>
}

export const useBodyStore = create<BodyStore>((set) => ({
  height: null,
  goalWeight: null,
  loaded: false,

  async load(db) {
    const [h, g] = await Promise.all([
      db.kv.get('body_height'),
      db.kv.get('body_goalWeight'),
    ])
    set({
      height: (h?.value as number) ?? null,
      goalWeight: (g?.value as number) ?? null,
      loaded: true,
    })
  },

  async setHeight(v, db) {
    if (v === null) {
      await db.kv.delete('body_height')
    } else {
      await db.kv.put({ key: 'body_height', value: v })
    }

    // 批量更新历史 BMI
    if (v !== null) {
      const all = await db.weightRecords.toArray()
      const updates = all.map((r) => ({
        key: r.id,
        changes: { bmi: +(r.weight / (v / 100) ** 2).toFixed(1) },
      }))
      if (updates.length > 0) {
        await db.weightRecords.bulkUpdate(updates)
      }
    }
    set({ height: v })
  },

  async setGoalWeight(v, db) {
    if (v === null) {
      await db.kv.delete('body_goalWeight')
    } else {
      await db.kv.put({ key: 'body_goalWeight', value: v })
    }
    set({ goalWeight: v })
  },
}))
