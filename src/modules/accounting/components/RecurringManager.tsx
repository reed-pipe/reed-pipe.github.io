import { useState } from 'react'
import { Button, Modal, Form, InputNumber, Select, Input, Switch, Tag, Empty, Popconfirm, Grid } from 'antd'
import { PlusOutlined, DeleteOutlined, PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDb } from '@/shared/db/context'
import { useDataChanged } from '@/shared/sync/useDataChanged'
import type { AccRecurring, RecurringFrequency } from '@/shared/db'

const { useBreakpoint } = Grid

const FREQ_LABELS: Record<RecurringFrequency, string> = {
  daily: '每日',
  weekly: '每周',
  monthly: '每月',
}

interface Props {
  ledgerId: number
}

export default function RecurringManager({ ledgerId }: Props) {
  const db = useDb()
  const notifyChanged = useDataChanged()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()

  const rules = useLiveQuery(
    () => db.accRecurring
      .filter(r => !r.deletedAt && r.ledgerId === ledgerId)
      .toArray(),
    [db, ledgerId]
  ) ?? []

  const categories = useLiveQuery(
    () => db.accCategories.filter(r => !r.deletedAt).toArray(),
    [db]
  ) ?? []

  const openAdd = () => {
    setEditingId(null)
    form.resetFields()
    form.setFieldsValue({ type: 'expense', frequency: 'monthly', isActive: true, tags: [] })
    setModalOpen(true)
  }

  const openEdit = (rule: AccRecurring) => {
    setEditingId(rule.id)
    form.setFieldsValue({
      type: rule.type,
      categoryId: rule.categoryId,
      amount: rule.amount,
      note: rule.note,
      frequency: rule.frequency,
      startDate: rule.startDate,
      endDate: rule.endDate,
      isActive: rule.isActive,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    const now = Date.now()
    if (editingId) {
      await db.accRecurring.update(editingId, { ...values, updatedAt: now })
    } else {
      await db.accRecurring.add({
        ...values,
        ledgerId,
        tags: values.tags ?? [],
        endDate: values.endDate ?? null,
        lastGeneratedDate: null,
        createdAt: now,
        updatedAt: now,
      })
    }
    notifyChanged()
    setModalOpen(false)
  }

  const handleDelete = async (id: number) => {
    await db.accRecurring.update(id, { deletedAt: Date.now(), updatedAt: Date.now() })
    notifyChanged()
  }

  const toggleActive = async (rule: AccRecurring) => {
    await db.accRecurring.update(rule.id, {
      isActive: !rule.isActive,
      updatedAt: Date.now(),
    })
    notifyChanged()
  }

  return (
    <div style={{ padding: isMobile ? '8px 0' : '12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>定期记账规则</span>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openAdd}>
          添加规则
        </Button>
      </div>

      {rules.length === 0 ? (
        <Empty description="暂无定期规则" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rules.map(rule => {
            const cat = categories.find(c => c.id === rule.categoryId)
            return (
              <div
                key={rule.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #f0f0f0',
                  opacity: rule.isActive ? 1 : 0.5,
                  cursor: 'pointer',
                }}
                onClick={() => openEdit(rule)}
              >
                <span style={{ fontSize: 24 }}>{cat?.emoji ?? '💰'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>
                    {cat?.name ?? '未知'}{' '}
                    <Tag color="blue" style={{ fontSize: 11 }}>{FREQ_LABELS[rule.frequency]}</Tag>
                    {!rule.isActive && <Tag color="default">已暂停</Tag>}
                  </div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                    {rule.type === 'expense' ? '-' : '+'}{rule.amount} · 从 {rule.startDate.slice(5)} 开始
                    {rule.endDate && ` · 到 ${rule.endDate.slice(5)}`}
                  </div>
                </div>
                <Button
                  type="text"
                  size="small"
                  icon={rule.isActive ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                  onClick={(e) => { e.stopPropagation(); toggleActive(rule) }}
                />
                <Popconfirm title="确定删除？" onConfirm={() => handleDelete(rule.id)} onPopupClick={e => e.stopPropagation()}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={e => e.stopPropagation()} />
                </Popconfirm>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        title={editingId ? '编辑规则' : '添加定期规则'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        width={400}
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="middle">
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={[
              { label: '支出', value: 'expense' },
              { label: '收入', value: 'income' },
            ]} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
            {() => (
              <Form.Item name="categoryId" label="分类" rules={[{ required: true }]}>
                <Select
                  options={categories
                    .filter(c => c.type === form.getFieldValue('type'))
                    .map(c => ({ label: `${c.emoji} ${c.name}`, value: c.id }))}
                  placeholder="选择分类"
                />
              </Form.Item>
            )}
          </Form.Item>
          <Form.Item name="amount" label="金额" rules={[{ required: true }]}>
            <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} placeholder="0.00" />
          </Form.Item>
          <Form.Item name="frequency" label="频率" rules={[{ required: true }]}>
            <Select options={[
              { label: '每日', value: 'daily' },
              { label: '每周', value: 'weekly' },
              { label: '每月', value: 'monthly' },
            ]} />
          </Form.Item>
          <Form.Item name="startDate" label="开始日期" rules={[{ required: true }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="endDate" label="结束日期（留空为永久）">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input placeholder="可选备注" />
          </Form.Item>
          <Form.Item name="isActive" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
