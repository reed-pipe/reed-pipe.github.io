import { Modal, Button, Empty, Tag } from 'antd'
import { CheckOutlined } from '@ant-design/icons'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDb } from '@/shared/db/context'
import { useDataChanged } from './useDataChanged'
import type { SyncConflict } from '@/shared/db'

interface Props {
  open: boolean
  onClose: () => void
}

export default function ConflictResolver({ open, onClose }: Props) {
  const db = useDb()
  const notifyChanged = useDataChanged()

  const conflicts = useLiveQuery(
    () => db.syncConflicts.where('status').equals('pending').toArray(),
    [db]
  ) ?? []

  const resolveConflict = async (conflict: SyncConflict, useLocal: boolean) => {
    const data = useLocal ? conflict.localData : conflict.remoteData

    // Apply the chosen version to the actual table
    if (conflict.table === 'kv') {
      await db.kv.put(data as any)
    } else {
      const table = db.table(conflict.table)
      await table.put(data as any)
    }

    // Mark conflict as resolved
    await db.syncConflicts.update(conflict.id, { status: 'resolved' })
    notifyChanged()
  }

  const resolveAllLocal = async () => {
    for (const c of conflicts) await resolveConflict(c, true)
  }

  const resolveAllRemote = async () => {
    for (const c of conflicts) await resolveConflict(c, false)
  }

  return (
    <Modal
      title={`同步冲突 (${conflicts.length})`}
      open={open}
      onCancel={onClose}
      footer={conflicts.length > 1 ? [
        <Button key="all-local" onClick={resolveAllLocal}>全部保留本地</Button>,
        <Button key="all-remote" type="primary" onClick={resolveAllRemote}>全部使用云端</Button>,
      ] : null}
      width={560}
    >
      {conflicts.length === 0 ? (
        <Empty description="没有待解决的冲突" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 400, overflow: 'auto' }}>
          {conflicts.map(c => (
            <div key={c.id} style={{
              padding: 12, borderRadius: 10, border: '1px solid #f0f0f0',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Tag color="orange">{c.table}</Tag>
                <span style={{ fontSize: 12, color: '#999' }}>记录 #{String(c.recordId)}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={() => resolveConflict(c, true)}
                >
                  保留本地
                </Button>
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={() => resolveConflict(c, false)}
                >
                  使用云端
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
