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
  bodyFat?: number // 体脂率 %
  note?: string
  createdAt: number // timestamp
}

export interface BodyMeasurement {
  id: number
  date: string // "YYYY-MM-DD"
  waist?: number // 腰围 cm
  hip?: number // 臀围 cm
  chest?: number // 胸围 cm
  arm?: number // 臂围 cm
  thigh?: number // 腿围 cm
  note?: string
  createdAt: number // timestamp
}

export type AppDb = Dexie & {
  kv: EntityTable<KVItem, 'key'>
  weightRecords: EntityTable<WeightRecord, 'id'>
  bodyMeasurements: EntityTable<BodyMeasurement, 'id'>
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

  db.version(3).stores({
    kv: 'key',
    weightRecords: '++id, date, createdAt',
    bodyMeasurements: '++id, date, createdAt',
  })

  return db
}
