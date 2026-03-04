import Dexie, { type EntityTable } from 'dexie'

export interface KVItem {
  key: string
  value: unknown
}

export interface WeightRecord {
  id: number
  date: string // "YYYY-MM-DD"
  period: 'morning' | 'evening' | 'other'
  weight: number // kg
  bmi?: number
  note?: string
  createdAt: number // timestamp
}

export type AppDb = Dexie & {
  kv: EntityTable<KVItem, 'key'>
  weightRecords: EntityTable<WeightRecord, 'id'>
}

export function createDb(username: string): AppDb {
  const db = new Dexie(`PA_${username}`) as AppDb

  db.version(1).stores({
    kv: 'key',
  })

  db.version(2).stores({
    kv: 'key',
    weightRecords: '++id, date, createdAt',
  })

  return db
}
