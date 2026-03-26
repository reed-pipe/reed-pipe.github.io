import { useMemo, useState } from 'react'
import { Typography, Input, Tag, Grid } from 'antd'
import { SearchOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDb } from '@/shared/db/context'
import type { AccTransaction } from '@/shared/db'
import { groupTransactionsByDate, formatDateLabel, getWeekDay, getMonthRange } from '../utils'
import QuickEntry from './QuickEntry'
import { useTheme } from '@/shared/hooks/useTheme'

const { Text } = Typography
const { useBreakpoint } = Grid

interface Props {
  ledgerId: number
  yearMonth: string
  filterDate?: string | null
  onClearFilter?: () => void
  onAdd?: () => void
}

export default function TransactionList({ ledgerId, yearMonth, filterDate, onClearFilter, onAdd }: Props) {
  const { colors, isDark } = useTheme()
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
      .filter(r => !r.deletedAt)
      .toArray(),
    [db, ledgerId, start, end],
  ) ?? []

  const categories = useLiveQuery(
    () => db.accCategories.filter(r => !r.deletedAt).toArray(),
    [db],
  ) ?? []

  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])

  const filtered = useMemo(() => {
    let result = transactions
    if (filterDate) result = result.filter(t => t.date === filterDate)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(t => {
        const cat = catMap.get(t.categoryId)
        return t.note?.toLowerCase().includes(q) ||
          cat?.name.toLowerCase().includes(q) ||
          t.tags?.some(tag => tag.toLowerCase().includes(q))
      })
    }
    return result
  }, [transactions, search, catMap, filterDate])

  const groups = useMemo(() => groupTransactionsByDate(filtered), [filtered])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {filterDate && (
        <Tag
          color="blue" closable onClose={onClearFilter} closeIcon={<CloseCircleOutlined />}
          style={{ alignSelf: 'flex-start', margin: '0 0 8px 0', padding: '2px 10px', borderRadius: 8 }}
        >
          {formatDateLabel(filterDate)} {getWeekDay(filterDate)} 的记录
        </Tag>
      )}

      <Input
        prefix={<SearchOutlined style={{ color: colors.textTertiary }} />}
        placeholder="搜索备注、分类..."
        value={search} onChange={e => setSearch(e.target.value)}
        allowClear size="small" variant="filled"
        style={{ borderRadius: 20, marginBottom: 12, background: colors.borderLight, fontSize: 13 }}
      />

      {groups.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '48px 0', color: colors.textTertiary,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: colors.borderLight,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 12, fontSize: 24,
          }}>
            📋
          </div>
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            {search || filterDate ? '没有匹配的记录' : '暂无记账记录'}
          </span>
          {!search && !filterDate && onAdd && (
            <button
              onClick={onAdd}
              style={{
                marginTop: 16, background: isDark ? '#242424' : '#18181B', color: '#fff',
                borderRadius: 12, padding: '10px 24px', fontSize: 13,
                fontWeight: 600, border: 'none', cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
            >
              记一笔
            </button>
          )}
        </div>
      ) : (
        groups.map(group => (
          <div key={group.date} style={{ marginBottom: isMobile ? 16 : 20 }}>
            {/* Date header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
              marginBottom: 8, padding: '0 2px',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>
                {formatDateLabel(group.date)}
              </span>
              <div style={{ display: 'flex', gap: 10, fontSize: 11, fontWeight: 500, color: colors.textTertiary }}>
                {group.totalIncome > 0 && <span>收 {group.totalIncome.toFixed(2)}</span>}
                {group.totalExpense > 0 && <span>支 {group.totalExpense.toFixed(2)}</span>}
              </div>
            </div>

            {/* Transactions card */}
            <div style={{
              background: colors.bgElevated, borderRadius: 16,
              border: `1px solid ${colors.borderLight}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              overflow: 'hidden',
            }}>
              {group.transactions.map((t, idx) => {
                const cat = catMap.get(t.categoryId)
                const isLast = idx === group.transactions.length - 1

                return (
                  <div
                    key={t.id}
                    onClick={() => setEditing(t)}
                    style={{
                      display: 'flex', alignItems: 'center',
                      padding: isMobile ? '12px 14px' : '14px 16px',
                      cursor: 'pointer', transition: 'background 0.15s',
                      borderBottom: isLast ? 'none' : `1px solid ${colors.bg}`,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = colors.bg }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginRight: 12, flexShrink: 0, fontSize: 20,
                      background: t.type === 'expense' ? colors.borderLight : colors.successBg,
                    }}>
                      {cat?.emoji ?? '💰'}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginBottom: t.note ? 2 : 0,
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>
                          {cat?.name ?? '未知'}
                        </span>
                        <span style={{
                          fontSize: 15, fontWeight: 600,
                          color: t.type === 'income' ? '#10B981' : colors.text,
                        }}>
                          {t.type === 'expense' ? '-' : '+'}{t.amount.toFixed(2)}
                        </span>
                      </div>
                      {t.note && (
                        <Text style={{ fontSize: 11, color: colors.textTertiary, display: 'block' }} ellipsis>
                          {t.note}
                        </Text>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}

      <QuickEntry
        open={!!editing}
        onClose={() => setEditing(null)}
        ledgerId={ledgerId}
        editingTransaction={editing}
      />
    </div>
  )
}
