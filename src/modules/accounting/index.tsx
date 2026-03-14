import { useState, useEffect, useCallback, useMemo } from 'react'
import { Tabs, Button, Grid, Dropdown, Spin } from 'antd'
import {
  PlusOutlined,
  LeftOutlined,
  RightOutlined,
  SettingOutlined,
  AppstoreOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDb } from '@/shared/db/context'
import { useAccountingStore } from './store'
import { seedDefaultCategories, seedDefaultLedger, formatAmount, getMonthRange } from './utils'
import LedgerSelector from './components/LedgerSelector'
import MonthlySummary from './components/MonthlySummary'
import TransactionList from './components/TransactionList'
import CalendarView from './components/CalendarView'
import StatsCharts from './components/StatsCharts'
import BudgetManager from './components/BudgetManager'
import CategoryManager from './components/CategoryManager'
import QuickEntry from './components/QuickEntry'
import ExportModal from './components/ExportModal'
import { colors, gradients, shadows } from '@/shared/theme'

const { useBreakpoint } = Grid

export default function Accounting() {
  const db = useDb()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const defaultLedgerId = useAccountingStore(s => s.defaultLedgerId)
  const storeLoaded = useAccountingStore(s => s.loaded)

  const [yearMonth, setYearMonth] = useState(dayjs().format('YYYY-MM'))
  const [quickEntryOpen, setQuickEntryOpen] = useState(false)
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('list')
  const [filterDate, setFilterDate] = useState<string | null>(null)

  // Seed defaults on first load
  useEffect(() => {
    const init = async () => {
      await seedDefaultCategories(db)
      await seedDefaultLedger(db)
      if (!storeLoaded) await useAccountingStore.getState().load(db)
    }
    init()
  }, [db, storeLoaded])

  // Get ledgers to determine current ledger
  const ledgers = useLiveQuery(() => db.ledgers.orderBy('sortOrder').toArray(), [db]) ?? []

  const currentLedgerId = defaultLedgerId ?? ledgers.find(l => l.isDefault)?.id ?? ledgers[0]?.id ?? 0

  const setLedgerId = useCallback((id: number) => {
    useAccountingStore.getState().setDefaultLedgerId(id, db)
  }, [db])

  const prevMonth = () => {
    setYearMonth(dayjs(yearMonth + '-01').subtract(1, 'month').format('YYYY-MM'))
    setFilterDate(null)
  }
  const nextMonth = () => {
    setYearMonth(dayjs(yearMonth + '-01').add(1, 'month').format('YYYY-MM'))
    setFilterDate(null)
  }

  const handleCalendarDateSelect = (date: string) => {
    setYearMonth(date.slice(0, 7))
    setFilterDate(date)
    setActiveTab('list')
  }

  const settingsMenuItems = [
    { key: 'categories', label: '分类管理', icon: <AppstoreOutlined /> },
    { key: 'export', label: '导出 CSV', icon: <DownloadOutlined /> },
  ]

  const handleSettingsClick = ({ key }: { key: string }) => {
    if (key === 'categories') setCategoryManagerOpen(true)
    if (key === 'export') setExportOpen(true)
  }

  // Inline summary data
  const { start, end } = useMemo(() => getMonthRange(yearMonth), [yearMonth])
  const transactions = useLiveQuery(
    () => db.accTransactions
      .where('[ledgerId+date]')
      .between([currentLedgerId, start], [currentLedgerId, end + '\uffff'])
      .toArray(),
    [db, currentLedgerId, start, end],
  ) ?? []

  const { income, expense } = useMemo(() => {
    let income = 0, expense = 0
    for (const t of transactions) {
      if (t.type === 'income') income += t.amount
      else expense += t.amount
    }
    return { income, expense }
  }, [transactions])

  const balance = income - expense

  // Parse year/month for display
  const [displayYear, displayMonth] = yearMonth.split('-')

  // Loading state
  if (!storeLoaded || ledgers.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!currentLedgerId) return null

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      position: 'relative',
      paddingBottom: 80,
    }}>
      {/* Hero header: month selector + summary */}
      <div style={{
        padding: isMobile ? '16px 16px 14px' : '20px 20px 16px',
        marginBottom: isMobile ? 4 : 8,
        background: '#fff',
        borderRadius: isMobile ? 0 : 16,
      }}>
        {/* Top row: ledger + settings */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          <LedgerSelector value={currentLedgerId} onChange={setLedgerId} />
          <Dropdown menu={{ items: settingsMenuItems, onClick: handleSettingsClick }}>
            <Button type="text" size="small" icon={<SettingOutlined />} />
          </Dropdown>
        </div>

        {/* Month selector - big title style */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          marginBottom: isMobile ? 12 : 16,
        }}>
          <Button type="text" size="small" icon={<LeftOutlined />} onClick={prevMonth}
            style={{ color: colors.textTertiary }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: isMobile ? 24 : 28, fontWeight: 800, color: colors.text,
              lineHeight: 1.1, letterSpacing: '-0.02em',
            }}>
              {Number(displayMonth)}月
            </div>
            <div style={{ fontSize: 11, color: colors.textTertiary }}>{displayYear}年</div>
          </div>
          <Button type="text" size="small" icon={<RightOutlined />} onClick={nextMonth}
            style={{ color: colors.textTertiary }} />
        </div>

        {/* Inline summary: big numbers */}
        <div style={{
          display: 'flex',
          gap: isMobile ? 16 : 32,
        }}>
          <div>
            <div style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 2 }}>支出</div>
            <div style={{
              fontSize: isMobile ? 20 : 24, fontWeight: 800, color: colors.danger,
              lineHeight: 1.1, letterSpacing: '-0.02em',
            }}>
              {formatAmount(expense)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 2 }}>收入</div>
            <div style={{
              fontSize: isMobile ? 20 : 24, fontWeight: 800, color: colors.success,
              lineHeight: 1.1, letterSpacing: '-0.02em',
            }}>
              {formatAmount(income)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 2 }}>结余</div>
            <div style={{
              fontSize: isMobile ? 20 : 24, fontWeight: 800,
              color: balance > 0 ? colors.success : balance < 0 ? colors.danger : colors.textSecondary,
              lineHeight: 1.1, letterSpacing: '-0.02em',
            }}>
              {balance === 0 ? '0' : (balance > 0 ? '+' : '-') + formatAmount(Math.abs(balance))}
            </div>
          </div>
        </div>

        {/* Desktop: show MonthlySummary with 环比 */}
        {!isMobile && (
          <div style={{ marginTop: 12 }}>
            <MonthlySummary ledgerId={currentLedgerId} yearMonth={yearMonth} compactMode />
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={key => { setActiveTab(key); if (key !== 'list') setFilterDate(null) }}
        size="small"
        style={{ padding: isMobile ? '0 12px' : '0 4px' }}
        items={[
          {
            key: 'list',
            label: '明细',
            children: (
              <TransactionList
                ledgerId={currentLedgerId}
                yearMonth={yearMonth}
                filterDate={filterDate}
                onClearFilter={() => setFilterDate(null)}
              />
            ),
          },
          {
            key: 'calendar',
            label: '日历',
            children: <CalendarView ledgerId={currentLedgerId} yearMonth={yearMonth} onSelectDate={handleCalendarDateSelect} />,
          },
          {
            key: 'charts',
            label: '图表',
            children: <StatsCharts ledgerId={currentLedgerId} yearMonth={yearMonth} />,
          },
          {
            key: 'budget',
            label: '预算',
            children: <BudgetManager ledgerId={currentLedgerId} yearMonth={yearMonth} />,
          },
        ]}
      />

      {/* Floating add button */}
      <button
        onClick={() => setQuickEntryOpen(true)}
        style={{
          position: 'fixed',
          right: isMobile ? 16 : 32,
          bottom: isMobile ? 20 : 32,
          width: isMobile ? 50 : 56,
          height: isMobile ? 50 : 56,
          borderRadius: '50%',
          border: 'none',
          background: gradients.primary,
          color: '#fff',
          fontSize: isMobile ? 20 : 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: shadows.primaryStrong,
          zIndex: 100,
          transition: 'transform 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <PlusOutlined />
      </button>

      {/* Quick entry */}
      <QuickEntry
        open={quickEntryOpen}
        onClose={() => setQuickEntryOpen(false)}
        ledgerId={currentLedgerId}
      />

      {/* Category manager */}
      <CategoryManager
        open={categoryManagerOpen}
        onClose={() => setCategoryManagerOpen(false)}
      />

      {/* Export modal */}
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        ledgerId={currentLedgerId}
      />
    </div>
  )
}
