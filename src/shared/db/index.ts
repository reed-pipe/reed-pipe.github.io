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
  leftArm?: number // 左臂围 cm
  rightArm?: number // 右臂围 cm
  leftThigh?: number // 左腿围 cm
  rightThigh?: number // 右腿围 cm
  note?: string
  createdAt: number // timestamp
}

export type TransportType = 'plane' | 'train' | 'car' | 'bus' | 'ship' | 'bike' | 'walk' | 'other'
export type CostCategory = 'transport' | 'food' | 'hotel' | 'ticket' | 'shopping' | 'other'

export interface Trip {
  id: number
  title: string
  destination: string
  lat?: number
  lng?: number
  departureName?: string
  departureLat?: number
  departureLng?: number
  startDate: string // "YYYY-MM-DD"
  endDate: string // "YYYY-MM-DD"
  coverPhoto?: string // base64 data URL
  summary?: string
  tags: string[]
  rating?: number // 1-5
  totalCost?: number
  createdAt: number
}

export interface TripSpot {
  id: number
  tripId: number
  name: string
  date: string // "YYYY-MM-DD"
  lat?: number
  lng?: number
  address?: string
  photos: string[] // base64 data URLs
  note?: string
  cost?: number
  costCategory?: CostCategory
  transport?: TransportType
  sortOrder: number
  createdAt: number
}

export type AppDb = Dexie & {
  kv: EntityTable<KVItem, 'key'>
  weightRecords: EntityTable<WeightRecord, 'id'>
  bodyMeasurements: EntityTable<BodyMeasurement, 'id'>
  trips: EntityTable<Trip, 'id'>
  tripSpots: EntityTable<TripSpot, 'id'>
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

  db.version(4).stores({
    kv: 'key',
    weightRecords: '++id, date, createdAt',
    bodyMeasurements: '++id, date, createdAt',
    trips: '++id, startDate, createdAt',
    tripSpots: '++id, tripId, date, createdAt',
  })

  // v5: add costCategory to tripSpots (no index change needed, just schema compat)
  db.version(5).stores({
    kv: 'key',
    weightRecords: '++id, date, createdAt',
    bodyMeasurements: '++id, date, createdAt',
    trips: '++id, startDate, createdAt',
    tripSpots: '++id, tripId, date, createdAt',
  })

  return db
}
