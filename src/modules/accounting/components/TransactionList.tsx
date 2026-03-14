import { useMemo, useState } from 'react'
import { Typography, Empty, Input, Popconfirm, message, Tag, Grid } from 'antd'
import { SearchOutlined, DeleteOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDb } from '@/shared/db/context'
import { useDataChanged } from '@/shared/sync/useDataChanged'
import type { AccTransaction } from '@/shared/db'
import { groupTransactionsByDate, formatAmount, formatDateLabel, getWeekDay, getMonthRange } from '../utils'
import { colors, shadows } from '@/shared/theme'
import QuickEntry from './QuickEntry'

const { Text } = Typography
const { useBreakpoint } = Grid

interface Props {
  ledgerId: number
  yearMonth: string // "2026-03"
  filterDate?: string | null
  onClearFilter?: () => void
}

export default function TransactionList({ ledgerId, yearMonth, filterDate, onClearFilter }: Props) {
  const db = useDb()
  const notifyChanged = useDataChanged()
  const screens = useBreakpoint()
  const isMobile = !screens.md
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
    let result = transactions

    // Filter by specific date
    if (filterDate) {
      result = result.filter(t => t.date === filterDate)
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(t => {
        const cat = catMap.get(t.categoryId)
        return (t.note?.toLowerCase().includes(q)) ||
          (cat?.name.toLowerCase().includes(q)) ||
          (t.tags?.some(tag => tag.toLowerCase().includes(q)))
      })
    }

    return result
  }, [transactions, search, catMap, filterDate])

  const groups = useMemo(() => groupTransactionsByDate(filtered), [filtered])

  const handleDelete = async (id: number) => {
    await db.accTransactions.delete(id)
    notifyChanged()
    message.success('已删除')
  }

  return (
    <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 12 }}>
      {/* Filter indicator */}
      {filterDate && (
        <Tag
          color="blue"
          closable
          onClose={onClearFilter}
          closeIcon={<CloseCircleOutlined />}
          style={{ alignSelf: 'flex-start', margin: 0, padding: '2px 10px', borderRadius: 8 }}
        >
          {formatDateLabel(filterDate)} {getWeekDay(filterDate)} 的记录
        </Tag>
      )}

      {/* Search */}
      <Input
        prefix={<SearchOutlined style={{ color: colors.textTertiary }} />}
        placeholder="搜索备注、分类、标签..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        allowClear
        size={isMobile ? 'small' : 'middle'}
        style={{ borderRadius: 12 }}
      />

      {groups.length === 0 ? (
        <Empty description={search || filterDate ? '没有匹配的记录' : '本月暂无记录'} style={{ padding: 32 }} />
      ) : (
        groups.map(group => (
          <div key={group.date}>
            {/* Date header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: isMobile ? '4px 2px' : '6px 4px',
              marginBottom: isMobile ? 4 : 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Text strong style={{ fontSize: isMobile ? 13 : 14 }}>{formatDateLabel(group.date)}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{getWeekDay(group.date)}</Text>
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                {group.totalExpense > 0 && (
                  <Text style={{ color: colors.danger }}>支 {formatAmount(group.totalExpense)}</Text>
                )}
                {group.totalIncome > 0 && (
                  <Text style={{ color: colors.success }}>收 {formatAmount(group.totalIncome)}</Text>
                )}
              </div>
            </div>

            {/* Transactions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 3 : 4 }}>
              {group.transactions.map(t => {
                const cat = catMap.get(t.categoryId)
                return (
                  <div
                    key={t.id}
                    onClick={() => setEditing(t)}
                    style={{
                      display: 'flex', alignItems: 'center',
                      gap: isMobile ? 8 : 12,
                      padding: isMobile ? '10px 10px' : '12px 14px',
                      borderRadius: 12,
                      background: '#fff',
                      border: `1px solid ${colors.borderLight}`,
                      boxShadow: shadows.card,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {/* Category icon */}
                    <div style={{
                      width: isMobile ? 34 : 40, height: isMobile ? 34 : 40,
                      borderRadius: 10,
                      background: `${cat?.color ?? '#6B7280'}12`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: isMobile ? 17 : 20, flexShrink: 0,
                    }}>
                      {cat?.emoji ?? '💰'}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: isMobile ? 13 : 14, fontWeight: 500, display: 'block' }} ellipsis>
                        {cat?.name ?? '未知'}
                      </Text>
                      {t.note && (
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }} ellipsis>
                          {t.note}
                        </Text>
                      )}
                      {t.tags && t.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: 3, marginTop: 2, flexWrap: 'wrap' }}>
                          {t.tags.map(tag => (
                            <span key={tag} style={{
                              fontSize: 9, padding: '1px 5px', borderRadius: 4,
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
                      fontSize: isMobile ? 14 : 16, flexShrink: 0, fontWeight: 700,
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
                        style={{ color: colors.textTertiary, fontSize: 13, padding: 4 }}
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
