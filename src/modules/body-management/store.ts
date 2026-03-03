import { create } from 'zustand'
import { db } from '@/shared/db'

interface BodyStore {
  height: number | null // cm
  goalWeight: number | null // kg
  loaded: boolean
  load: () => Promise<void>
  setHeight: (v: number | null) => Promise<void>
  setGoalWeight: (v: number | null) => Promise<void>
}

export const useBodyStore = create<BodyStore>((set) => ({
  height: null,
  goalWeight: null,
  loaded: false,

  async load() {
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

  async setHeight(v) {
    if (v === null) {
      await db.kv.delete('body_height')
    } else {
      await db.kv.put({ key: 'body_height', value: v })
    }

    // 批量更新历史 BMI（先完成 DB 写入再更新 UI）
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

  async setGoalWeight(v) {
    if (v === null) {
      await db.kv.delete('body_goalWeight')
    } else {
      await db.kv.put({ key: 'body_goalWeight', value: v })
    }
    set({ goalWeight: v })
  },
}))
