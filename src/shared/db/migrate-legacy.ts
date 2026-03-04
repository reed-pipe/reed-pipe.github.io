import Dexie from 'dexie'
import type { AppDb } from './index'

const LEGACY_DB_NAME = 'PersonalAssistantDB'
const MIGRATED_KEY = 'pa_legacy_migrated'

export async function migrateLegacyData(targetDb: AppDb): Promise<boolean> {
  // 只迁移一次
  if (localStorage.getItem(MIGRATED_KEY)) return false

  // 检查旧数据库是否存在
  const databases = await Dexie.getDatabaseNames()
  if (!databases.includes(LEGACY_DB_NAME)) {
    localStorage.setItem(MIGRATED_KEY, '1')
    return false
  }

  const legacyDb = new Dexie(LEGACY_DB_NAME)

  try {
    // 打开旧数据库，读取已有 schema
    await legacyDb.open()
    const tables = legacyDb.tables.map((t) => t.name)

    let migrated = false

    if (tables.includes('kv')) {
      const kvItems = await legacyDb.table('kv').toArray()
      if (kvItems.length > 0) {
        await targetDb.kv.bulkPut(kvItems)
        migrated = true
      }
    }

    if (tables.includes('weightRecords')) {
      const records = await legacyDb.table('weightRecords').toArray()
      if (records.length > 0) {
        await targetDb.weightRecords.bulkPut(records)
        migrated = true
      }
    }

    localStorage.setItem(MIGRATED_KEY, '1')
    return migrated
  } catch {
    return false
  } finally {
    legacyDb.close()
  }
}
