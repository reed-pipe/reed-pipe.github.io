import Dexie, { type EntityTable } from 'dexie'

/**
 * 全局 Dexie 数据库实例
 *
 * 在此定义所有模块共享或独立的 IndexedDB 表。
 * 各模块也可以创建自己的 Dexie 实例，但共享数据建议放在这里。
 *
 * 示例 —— 添加新表：
 *   1. 定义接口
 *   2. 在 stores() 中声明 schema
 *   3. 在 db 对象上声明类型
 */

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

const db = new Dexie('PersonalAssistantDB') as Dexie & {
  kv: EntityTable<KVItem, 'key'>
  weightRecords: EntityTable<WeightRecord, 'id'>
}

db.version(1).stores({
  /** 通用键值存储 */
  kv: 'key',
})

db.version(2).stores({
  kv: 'key',
  weightRecords: '++id, date, createdAt',
})

export { db }
