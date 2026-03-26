import { useState } from 'react'
import { Modal, Segmented, Input, Button, Popconfirm, message, ColorPicker, Grid } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDb } from '@/shared/db/context'
import { useDataChanged } from '@/shared/sync/useDataChanged'
import type { TransactionType, AccCategory } from '@/shared/db'

interface Props {
  open: boolean
  onClose: () => void
}

const CATEGORY_EMOJIS = ['🍜', '🚌', '🛒', '🏠', '📱', '💡', '🎬', '🏥', '📚', '👔', '🧴', '🎁', '🐱', '☕', '🍰', '💼', '📈', '💹', '💸', '🎮', '🏃', '🎵', '📷', '💊', '🚗', '🏨', '💰']

const { useBreakpoint } = Grid

export default function CategoryManager({ open, onClose }: Props) {
  const db = useDb()
  const notifyChanged = useDataChanged()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [type, setType] = useState<TransactionType>('expense')
  const [editing, setEditing] = useState<Partial<AccCategory> | null>(null)

  const categories = useLiveQuery(
    () => db.accCategories.where('type').equals(type).filter(r => !r.deletedAt).sortBy('sortOrder'),
    [db, type],
  ) ?? []

  const handleSave = async () => {
    if (!editing?.name?.trim()) {
      message.warning('请输入分类名称')
      return
    }
    if (editing.id) {
      await db.accCategories.update(editing.id, {
        name: editing.name,
        emoji: editing.emoji || '💰',
        color: editing.color || '#6B7280',
        updatedAt: Date.now(),
      })
    } else {
      await db.accCategories.add({
        type,
        name: editing.name,
        emoji: editing.emoji || '💰',
        color: editing.color || '#6B7280',
        isCustom: true,
        sortOrder: categories.length,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
    notifyChanged()
    setEditing(null)
  }

  const handleDelete = async (cat: AccCategory) => {
    if (!cat.isCustom) {
      message.warning('预设分类不可删除')
      return
    }
    const txnCount = await db.accTransactions.where('categoryId').equals(cat.id).count()
    if (txnCount > 0) {
      message.error(`该分类下有 ${txnCount} 条记录，不能删除`)
      return
    }
    await db.accCategories.delete(cat.id)
    notifyChanged()
  }

  return (
    <Modal
      title="分类管理"
      open={open}
      onCancel={onClose}
      footer={null}
      width={isMobile ? '92vw' : 440}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Segmented
          block
          value={type}
          onChange={v => setType(v as TransactionType)}
          options={[
            { label: '支出', value: 'expense' },
            { label: '收入', value: 'income' },
          ]}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 380, overflowY: 'auto' }}>
          {categories.map(cat => (
            <div key={cat.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 12,
              background: '#FAFAFA',
            }}>
              <span style={{ fontSize: 22 }}>{cat.emoji}</span>
              <span style={{ flex: 1, fontWeight: 500, fontSize: 14 }}>{cat.name}</span>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: cat.color }} />
              {cat.isCustom ? (
                <>
                  <Button size="small" type="text"
                    onClick={() => setEditing({ id: cat.id, name: cat.name, emoji: cat.emoji, color: cat.color })}
                  >
                    编辑
                  </Button>
                  <Popconfirm title="确认删除？" onConfirm={() => handleDelete(cat)}>
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </>
              ) : (
                <span style={{ fontSize: 11, color: '#A1A1AA' }}>预设</span>
              )}
            </div>
          ))}
        </div>

        {editing ? (
          <div style={{ padding: 14, borderRadius: 14, background: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATEGORY_EMOJIS.map(e => (
                <span
                  key={e}
                  onClick={() => setEditing({ ...editing, emoji: e })}
                  style={{
                    fontSize: 18, cursor: 'pointer', padding: 4, borderRadius: 8,
                    background: editing.emoji === e ? '#F4F4F5' : 'transparent',
                  }}
                >
                  {e}
                </span>
              ))}
            </div>
            <Input
              value={editing.name ?? ''}
              onChange={e => setEditing({ ...editing, name: e.target.value })}
              placeholder="分类名称"
              onPressEnter={handleSave}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13 }}>颜色</span>
              <ColorPicker
                value={editing.color || '#6B7280'}
                onChange={(_, hex) => setEditing({ ...editing, color: hex })}
                size="small"
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button block onClick={() => setEditing(null)}>取消</Button>
              <Button block type="primary" onClick={handleSave}>
                {editing.id ? '更新' : '添加'}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            block
            onClick={() => setEditing({ emoji: '💰', color: '#6B7280' })}
          >
            添加自定义分类
          </Button>
        )}
      </div>
    </Modal>
  )
}
