import { useMemo, useState } from 'react'
import { Typography, Empty, Input, Popconfirm, message } from 'antd'
import { SearchOutlined, DeleteOutlined } from '@ant-design/icons'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDb } from '@/shared/db/context'
import { useDataChanged } from '@/shared/sync/useDataChanged'
import type { AccTransaction } from '@/shared/db'
import { groupTransactionsByDate, formatAmount, formatDateLabel, getWeekDay, getMonthRange } from '../utils'
import { colors, shadows } from '@/shared/theme'
import QuickEntry from './QuickEntry'

const { Text } = Typography

interface Props {
  ledgerId: number
  yearMonth: string // "2026-03"
}

export default function TransactionList({ ledgerId, yearMonth }: Props) {
  const db = useDb()
  const notifyChanged = useDataChanged()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<AccTransaction | null>(null)

  const { start, end } = useMemo(() => getMonthRange(yearMonth), [yearMonth])

  const transactions = useLiveQuery(
    () => db.accTransactions
      .where('[ledgerId+date]')
      .between([ledgerId, start], [ledgerId, end + '\uffff'])
      .toArray(),
    [db, ledgerId, start, end],
  ) ?? []

  const categories = useLiveQuery(
    () => db.accCategories.toArray(),
    [db],
  ) ?? []

  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])

  const filtered = useMemo(() => {
    if (!search.trim()) return transactions
    const q = search.toLowerCase()
    return transactions.filter(t => {
      const cat = catMap.get(t.categoryId)
      return (t.note?.toLowerCase().includes(q)) ||
        (cat?.name.toLowerCase().includes(q)) ||
        (t.tags?.some(tag => tag.toLowerCase().includes(q)))
    })
  }, [transactions, search, catMap])

  const groups = useMemo(() => groupTransactionsByDate(filtered), [filtered])

  const handleDelete = async (id: number) => {
    await db.accTransactions.delete(id)
    notifyChanged()
    message.success('已删除')
  }

  return (
    <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Search */}
      <Input
        prefix={<SearchOutlined style={{ color: colors.textTertiary }} />}
        placeholder="搜索备注、分类、标签..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        allowClear
        style={{ borderRadius: 12 }}
      />

      {groups.length === 0 ? (
        <Empty description={search ? '没有匹配的记录' : '本月暂无记录'} style={{ padding: 40 }} />
      ) : (
        groups.map(group => (
          <div key={group.date}>
            {/* Date header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 4px', marginBottom: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text strong style={{ fontSize: 14 }}>{formatDateLabel(group.date)}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{getWeekDay(group.date)}</Text>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                {group.totalExpense > 0 && (
                  <Text style={{ color: colors.danger }}>支 {formatAmount(group.totalExpense)}</Text>
                )}
                {group.totalIncome > 0 && (
                  <Text style={{ color: colors.success }}>收 {formatAmount(group.totalIncome)}</Text>
                )}
              </div>
            </div>

            {/* Transactions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {group.transactions.map(t => {
                const cat = catMap.get(t.categoryId)
                return (
                  <div
                    key={t.id}
                    onClick={() => setEditing(t)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 14,
                      background: '#fff',
                      border: `1px solid ${colors.borderLight}`,
                      boxShadow: shadows.card,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {/* Category icon */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: `${cat?.color ?? '#6B7280'}12`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20, flexShrink: 0,
                    }}>
                      {cat?.emoji ?? '💰'}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 14, fontWeight: 500, display: 'block' }} ellipsis>
                        {cat?.name ?? '未知'}
                      </Text>
                      {t.note && (
                        <Text type="secondary" style={{ fontSize: 12, display: 'block' }} ellipsis>
                          {t.note}
                        </Text>
                      )}
                      {t.tags && t.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                          {t.tags.map(tag => (
                            <span key={tag} style={{
                              fontSize: 10, padding: '1px 6px', borderRadius: 4,
                              background: colors.bg, color: colors.textTertiary,
                            }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Amount */}
                    <Text strong style={{
                      fontSize: 16, flexShrink: 0, fontWeight: 700,
                      color: t.type === 'expense' ? colors.danger : colors.success,
                    }}>
                      {t.type === 'expense' ? '-' : '+'}{formatAmount(t.amount)}
                    </Text>

                    {/* Delete */}
                    <Popconfirm
                      title="确认删除？"
                      onConfirm={(e) => { e?.stopPropagation(); handleDelete(t.id) }}
                      onCancel={(e) => e?.stopPropagation()}
                    >
                      <DeleteOutlined
                        onClick={e => e.stopPropagation()}
                        style={{ color: colors.textTertiary, fontSize: 14, padding: 4 }}
                      />
                    </Popconfirm>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}

      {/* Edit modal */}
      <QuickEntry
        open={!!editing}
        onClose={() => setEditing(null)}
        ledgerId={ledgerId}
        editingTransaction={editing}
      />
    </div>
  )
}
