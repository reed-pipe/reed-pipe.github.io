import { useState } from 'react'
import { Select, Modal, Input, Button, Popconfirm, message, ColorPicker, Grid } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDb } from '@/shared/db/context'
import { useDataChanged } from '@/shared/sync/useDataChanged'
import { useAccountingStore } from '../store'
import type { Ledger } from '@/shared/db'

interface Props {
  value: number
  onChange: (id: number) => void
}

const LEDGER_EMOJIS = ['📒', '💳', '🏠', '✈️', '🎮', '📦', '🎓', '💍']

const { useBreakpoint } = Grid

export default function LedgerSelector({ value, onChange }: Props) {
  const db = useDb()
  const notifyChanged = useDataChanged()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [manageOpen, setManageOpen] = useState(false)
  const [editingLedger, setEditingLedger] = useState<Partial<Ledger> | null>(null)

  const ledgers = useLiveQuery(
    () => db.ledgers.orderBy('sortOrder').toArray(),
    [db],
  ) ?? []

  const handleAddOrUpdate = async () => {
    if (!editingLedger?.name?.trim()) {
      message.warning('请输入账本名称')
      return
    }
    if (editingLedger.id) {
      await db.ledgers.update(editingLedger.id, {
        name: editingLedger.name,
        emoji: editingLedger.emoji || '📒',
        color: editingLedger.color || '#F5722D',
      })
    } else {
      const id = await db.ledgers.add({
        name: editingLedger.name,
        emoji: editingLedger.emoji || '📒',
        color: editingLedger.color || '#F5722D',
        isDefault: false,
        sortOrder: ledgers.length,
        createdAt: Date.now(),
      })
      onChange(id as number)
    }
    notifyChanged()
    setEditingLedger(null)
  }

  const handleDelete = async (id: number) => {
    const txnCount = await db.accTransactions.where('ledgerId').equals(id).count()
    if (txnCount > 0) {
      message.error(`该账本下有 ${txnCount} 条记录，不能删除`)
      return
    }
    await db.ledgers.delete(id)
    if (value === id && ledgers.length > 1) {
      const next = ledgers.find(l => l.id !== id)
      if (next) onChange(next.id)
    }
    notifyChanged()
  }

  const handleSetDefault = async (id: number) => {
    await useAccountingStore.getState().setDefaultLedgerId(id, db)
    notifyChanged()
  }

  return (
    <>
      <Select
        value={value}
        onChange={onChange}
        style={{ minWidth: 140 }}
        popupMatchSelectWidth={false}
        dropdownRender={menu => (
          <div>
            {menu}
            <div
              style={{
                padding: '8px 12px', borderTop: '1px solid #F4F4F5',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                color: '#18181B', fontSize: 13,
              }}
              onClick={() => { setManageOpen(true) }}
            >
              <EditOutlined /> 管理账本
            </div>
          </div>
        )}
        options={ledgers.map(l => ({
          label: (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{l.emoji}</span>
              <span>{l.name}</span>
            </span>
          ),
          value: l.id,
        }))}
      />

      {/* Manage modal */}
      <Modal
        title="管理账本"
        open={manageOpen}
        onCancel={() => { setManageOpen(false); setEditingLedger(null) }}
        footer={null}
        width={isMobile ? '92vw' : 400}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ledgers.map(l => (
            <div key={l.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 12,
              background: '#FAFAFA',
              border: `1px solid ${l.id === value ? '#18181B' : '#F4F4F5'}`,
            }}>
              <span style={{ fontSize: 20 }}>{l.emoji}</span>
              <span style={{ flex: 1, fontWeight: 500 }}>{l.name}</span>
              {l.isDefault && (
                <span style={{ fontSize: 11, color: '#18181B', background: '#F4F4F5', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                  默认
                </span>
              )}
              {!l.isDefault && (
                <Button size="small" type="text" onClick={() => handleSetDefault(l.id)}>
                  设为默认
                </Button>
              )}
              <Button size="small" type="text" icon={<EditOutlined />}
                onClick={() => setEditingLedger({ id: l.id, name: l.name, emoji: l.emoji, color: l.color })}
              />
              <Popconfirm title="确认删除？" onConfirm={() => handleDelete(l.id)}>
                <Button size="small" type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </div>
          ))}

          {/* Add/edit form */}
          {editingLedger ? (
            <div style={{ padding: 12, borderRadius: 12, background: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {LEDGER_EMOJIS.map(e => (
                  <span
                    key={e}
                    onClick={() => setEditingLedger({ ...editingLedger, emoji: e })}
                    style={{
                      fontSize: 20, cursor: 'pointer', padding: 4, borderRadius: 8,
                      background: editingLedger.emoji === e ? '#F4F4F5' : 'transparent',
                    }}
                  >
                    {e}
                  </span>
                ))}
              </div>
              <Input
                value={editingLedger.name ?? ''}
                onChange={e => setEditingLedger({ ...editingLedger, name: e.target.value })}
                placeholder="账本名称"
                onPressEnter={handleAddOrUpdate}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13 }}>颜色</span>
                <ColorPicker
                  value={editingLedger.color || '#F5722D'}
                  onChange={(_, hex) => setEditingLedger({ ...editingLedger, color: hex })}
                  size="small"
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button block onClick={() => setEditingLedger(null)}>取消</Button>
                <Button block type="primary" onClick={handleAddOrUpdate}>
                  {editingLedger.id ? '更新' : '添加'}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              block
              onClick={() => setEditingLedger({ emoji: '📒', color: '#F5722D' })}
            >
              新建账本
            </Button>
          )}
        </div>
      </Modal>
    </>
  )
}
