import { useMemo, useState } from 'react'
import { Typography, Empty, Input, Tag, Grid } from 'antd'
import { SearchOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDb } from '@/shared/db/context'
import type { AccTransaction } from '@/shared/db'
import { groupTransactionsByDate, formatAmount, formatDateLabel, getWeekDay, getMonthRange } from '../utils'
import { colors } from '@/shared/theme'
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Filter indicator */}
      {filterDate && (
        <Tag
          color="blue"
          closable
          onClose={onClearFilter}
          closeIcon={<CloseCircleOutlined />}
          style={{ alignSelf: 'flex-start', margin: '0 0 8px 0', padding: '2px 10px', borderRadius: 8 }}
        >
          {formatDateLabel(filterDate)} {getWeekDay(filterDate)} 的记录
        </Tag>
      )}

      {/* Search - subtle style */}
      <Input
        prefix={<SearchOutlined style={{ color: colors.textTertiary }} />}
        placeholder="搜索备注、分类..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        allowClear
        size="small"
        variant="filled"
        style={{
          borderRadius: 20,
          marginBottom: 12,
          background: colors.bg,
          fontSize: 13,
        }}
      />

      {groups.length === 0 ? (
        <Empty description={search || filterDate ? '没有匹配的记录' : '本月暂无记录'} style={{ padding: 32 }} />
      ) : (
        groups.map(group => (
          <div key={group.date} style={{ marginBottom: isMobile ? 8 : 12 }}>
            {/* Date header - simple text */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: isMobile ? '8px 4px 4px' : '10px 4px 6px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: isMobile ? 12 : 13, color: colors.textTertiary, fontWeight: 500 }}>
                  {formatDateLabel(group.date)}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textTertiary }}>{getWeekDay(group.date)}</Text>
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                {group.totalExpense > 0 && (
                  <Text style={{ color: colors.textTertiary }}>支出 {formatAmount(group.totalExpense)}</Text>
                )}
                {group.totalIncome > 0 && (
                  <Text style={{ color: colors.textTertiary }}>收入 {formatAmount(group.totalIncome)}</Text>
                )}
              </div>
            </div>

            {/* Transactions - flat rows */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {group.transactions.map((t, idx) => {
                const cat = catMap.get(t.categoryId)
                const isLast = idx === group.transactions.length - 1
                const primaryText = t.note || cat?.name || '未知'
                const secondaryText = t.note ? (cat?.name || '未知') : null

                return (
                  <div
                    key={t.id}
                    onClick={() => setEditing(t)}
                    style={{
                      display: 'flex', alignItems: 'center',
                      gap: isMobile ? 10 : 14,
                      padding: isMobile ? '12px 4px' : '14px 4px',
                      borderBottom: isLast ? 'none' : '1px solid #F3F4F6',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      borderRadius: 0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#FAFAFA' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    {/* Category icon - circle */}
                    <div style={{
                      width: 36, height: 36,
                      borderRadius: '50%',
                      background: `${cat?.color ?? '#6B7280'}15`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 17, flexShrink: 0,
                    }}>
                      {cat?.emoji ?? '💰'}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{
                        fontSize: isMobile ? 14 : 15, fontWeight: 500, display: 'block',
                        color: colors.text,
                      }} ellipsis>
                        {primaryText}
                      </Text>
                      {secondaryText && (
                        <Text style={{
                          fontSize: 11, display: 'block',
                          color: colors.textTertiary,
                          marginTop: 1,
                        }} ellipsis>
                          {secondaryText}
                        </Text>
                      )}
                    </div>

                    {/* Amount */}
                    <Text style={{
                      fontSize: isMobile ? 15 : 16, flexShrink: 0, fontWeight: 700,
                      color: t.type === 'expense' ? colors.text : colors.success,
                    }}>
                      {t.type === 'expense' ? '-' : '+'}{formatAmount(t.amount)}
                    </Text>
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
