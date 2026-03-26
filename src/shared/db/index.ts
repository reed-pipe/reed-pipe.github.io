import Dexie, { type Collection, type EntityTable } from 'dexie'

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
  updatedAt: number
  deletedAt?: number | null
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
  updatedAt: number
  deletedAt?: number | null
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
  updatedAt: number
  deletedAt?: number | null
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
  updatedAt: number
  deletedAt?: number | null
}

export type TransactionType = 'expense' | 'income'

export interface Ledger {
  id: number
  name: string
  emoji: string
  color: string
  isDefault: boolean
  sortOrder: number
  createdAt: number
  updatedAt: number
  deletedAt?: number | null
}

export interface AccCategory {
  id: number
  type: TransactionType
  name: string
  emoji: string
  color: string
  isCustom: boolean
  sortOrder: number
  createdAt: number
  updatedAt: number
  deletedAt?: number | null
}

export interface AccTransaction {
  id: number
  ledgerId: number
  type: TransactionType
  categoryId: number
  amount: number
  note: string
  tags: string[]
  date: string // "YYYY-MM-DD"
  recurringId?: number // 由定期规则生成时关联规则 id
  createdAt: number
  updatedAt: number
  deletedAt?: number | null
}

export interface AccBudget {
  id: number
  yearMonth: string // "2026-03"
  categoryId: number | null // null = 月度总预算
  amount: number
  createdAt: number
  updatedAt: number
  deletedAt?: number | null
}

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly'

export interface AccRecurring {
  id: number
  ledgerId: number
  type: TransactionType
  categoryId: number
  amount: number
  note: string
  tags: string[]
  frequency: RecurringFrequency
  startDate: string // "YYYY-MM-DD"
  endDate: string | null // null = 永久
  lastGeneratedDate: string | null
  isActive: boolean
  createdAt: number
  updatedAt: number
  deletedAt?: number | null
}

export interface SyncQueueItem {
  id: number
  action: 'create' | 'update' | 'delete'
  table: string
  recordId: string | number
  data: unknown
  createdAt: number
}

export interface SyncConflict {
  id: number
  table: string
  recordId: string | number
  localData: unknown
  remoteData: unknown
  status: 'pending' | 'resolved'
  createdAt: number
}

export type AppDb = Dexie & {
  kv: EntityTable<KVItem, 'key'>
  weightRecords: EntityTable<WeightRecord, 'id'>
  bodyMeasurements: EntityTable<BodyMeasurement, 'id'>
  trips: EntityTable<Trip, 'id'>
  tripSpots: EntityTable<TripSpot, 'id'>
  ledgers: EntityTable<Ledger, 'id'>
  accCategories: EntityTable<AccCategory, 'id'>
  accTransactions: EntityTable<AccTransaction, 'id'>
  accBudgets: EntityTable<AccBudget, 'id'>
  accRecurring: EntityTable<AccRecurring, 'id'>
  syncQueue: EntityTable<SyncQueueItem, 'id'>
  syncConflicts: EntityTable<SyncConflict, 'id'>
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

  // v6: accounting module
  db.version(6).stores({
    kv: 'key',
    weightRecords: '++id, date, createdAt',
    bodyMeasurements: '++id, date, createdAt',
    trips: '++id, startDate, createdAt',
    tripSpots: '++id, tripId, date, createdAt',
    ledgers: '++id, sortOrder, createdAt',
    accCategories: '++id, type, sortOrder, createdAt',
    accTransactions: '++id, ledgerId, type, categoryId, date, createdAt, [ledgerId+date], [ledgerId+type+date]',
    accBudgets: '++id, yearMonth, categoryId, createdAt, [yearMonth+categoryId]',
  })

  // v7: sync upgrade + recurring transactions
  db.version(7).stores({
    kv: 'key',
    weightRecords: '++id, date, createdAt, updatedAt, deletedAt',
    bodyMeasurements: '++id, date, createdAt, updatedAt, deletedAt',
    trips: '++id, startDate, createdAt, updatedAt, deletedAt',
    tripSpots: '++id, tripId, date, createdAt, updatedAt, deletedAt',
    ledgers: '++id, sortOrder, createdAt, updatedAt, deletedAt',
    accCategories: '++id, type, sortOrder, createdAt, updatedAt, deletedAt',
    accTransactions: '++id, ledgerId, type, categoryId, date, createdAt, updatedAt, deletedAt, [ledgerId+date], [ledgerId+type+date]',
    accBudgets: '++id, yearMonth, categoryId, createdAt, updatedAt, deletedAt, [yearMonth+categoryId]',
    accRecurring: '++id, ledgerId, frequency, isActive, createdAt, updatedAt, deletedAt',
    syncQueue: '++id, action, table, recordId, createdAt',
    syncConflicts: '++id, table, recordId, status, createdAt',
  }).upgrade(async (tx) => {
    // Idempotent: backfill updatedAt from createdAt, set deletedAt to null
    const tables = [
      'weightRecords', 'bodyMeasurements', 'trips', 'tripSpots',
      'ledgers', 'accCategories', 'accTransactions', 'accBudgets',
    ] as const
    for (const tableName of tables) {
      await tx.table(tableName).toCollection().modify((record: Record<string, unknown>) => {
        if (record.updatedAt === undefined) {
          record.updatedAt = record.createdAt ?? Date.now()
        }
        if (record.deletedAt === undefined) {
          record.deletedAt = null
        }
      })
    }
  })

  return db
}

/** Filter out soft-deleted records from a Dexie collection */
export function alive<T extends { deletedAt?: number | null }>(
  collection: Collection<T, unknown>
): Collection<T, unknown> {
  return collection.filter((r) => !r.deletedAt)
}

/** Sync-participating table names (kv uses different merge strategy) */
export const SYNCED_TABLES = [
  'weightRecords', 'bodyMeasurements', 'trips', 'tripSpots',
  'ledgers', 'accCategories', 'accTransactions', 'accBudgets', 'accRecurring',
] as const

/** Tables that are local-only and should NOT be synced */
export const LOCAL_ONLY_TABLES = ['syncQueue', 'syncConflicts'] as const
