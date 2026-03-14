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

  useEffect(() => {
    const init = async () => {
      await seedDefaultCategories(db)
      await seedDefaultLedger(db)
      if (!storeLoaded) await useAccountingStore.getState().load(db)
    }
    init()
  }, [db, storeLoaded])

  const ledgers = useLiveQuery(() => db.ledgers.orderBy('sortOrder').toArray(), [db]) ?? []
  const currentLedgerId = defaultLedgerId ?? ledgers.find(l => l.isDefault)?.id ?? ledgers[0]?.id ?? 0

  const setLedgerId = useCallback((id: number) => {
    useAccountingStore.getState().setDefaultLedgerId(id, db)
  }, [db])

  const prevMonth = () => { setYearMonth(dayjs(yearMonth + '-01').subtract(1, 'month').format('YYYY-MM')); setFilterDate(null) }
  const nextMonth = () => { setYearMonth(dayjs(yearMonth + '-01').add(1, 'month').format('YYYY-MM')); setFilterDate(null) }

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

  // Inline summary
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
  const [, displayMonth] = yearMonth.split('-')

  if (!storeLoaded || ledgers.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <Spin size="large" />
      </div>
    )
  }
  if (!currentLedgerId) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingBottom: 72 }}>
      {/* Header: single compact bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '0 2px 6px' : '0 4px 10px',
      }}>
        <LedgerSelector value={currentLedgerId} onChange={setLedgerId} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <Button type="text" size="small" icon={<LeftOutlined />} onClick={prevMonth} />
          <span style={{ fontSize: 15, fontWeight: 700, color: colors.text, minWidth: 56, textAlign: 'center' }}>
            {Number(displayMonth)}月
          </span>
          <Button type="text" size="small" icon={<RightOutlined />} onClick={nextMonth} />
        </div>
        <Dropdown menu={{ items: settingsMenuItems, onClick: handleSettingsClick }}>
          <Button type="text" size="small" icon={<SettingOutlined />} />
        </Dropdown>
      </div>

      {/* Summary row */}
      {isMobile ? (
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          padding: '8px 8px 10px',
          borderBottom: `1px solid ${colors.borderLight}`,
          marginBottom: 2,
        }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 10, color: colors.textTertiary }}>支出</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: colors.danger }}>{formatAmount(expense)}</div>
          </div>
          <div style={{ width: 1, background: colors.borderLight, margin: '4px 0' }} />
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 10, color: colors.textTertiary }}>收入</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: colors.success }}>{formatAmount(income)}</div>
          </div>
          <div style={{ width: 1, background: colors.borderLight, margin: '4px 0' }} />
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 10, color: colors.textTertiary }}>结余</div>
            <div style={{
              fontSize: 17, fontWeight: 700,
              color: balance > 0 ? colors.success : balance < 0 ? colors.danger : colors.textSecondary,
            }}>
              {balance === 0 ? '0' : (balance > 0 ? '+' : '') + formatAmount(balance)}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 32, padding: '8px 4px 12px' }}>
            <div>
              <div style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 2 }}>支出</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: colors.danger }}>{formatAmount(expense)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 2 }}>收入</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: colors.success }}>{formatAmount(income)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 2 }}>结余</div>
              <div style={{
                fontSize: 22, fontWeight: 800,
                color: balance > 0 ? colors.success : balance < 0 ? colors.danger : colors.textSecondary,
              }}>
                {balance === 0 ? '0' : (balance > 0 ? '+' : '') + formatAmount(balance)}
              </div>
            </div>
          </div>
          <MonthlySummary ledgerId={currentLedgerId} yearMonth={yearMonth} compactMode />
        </div>
      )}

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={key => { setActiveTab(key); if (key !== 'list') setFilterDate(null) }}
        size="small"
        items={[
          {
            key: 'list', label: '明细',
            children: <TransactionList ledgerId={currentLedgerId} yearMonth={yearMonth} filterDate={filterDate} onClearFilter={() => setFilterDate(null)} />,
          },
          { key: 'calendar', label: '日历', children: <CalendarView ledgerId={currentLedgerId} yearMonth={yearMonth} onSelectDate={handleCalendarDateSelect} /> },
          { key: 'charts', label: '图表', children: <StatsCharts ledgerId={currentLedgerId} yearMonth={yearMonth} /> },
          { key: 'budget', label: '预算', children: <BudgetManager ledgerId={currentLedgerId} yearMonth={yearMonth} /> },
        ]}
      />

      {/* Floating add button */}
      <button
        onClick={() => setQuickEntryOpen(true)}
        style={{
          position: 'fixed', right: isMobile ? 20 : 32, bottom: isMobile ? 24 : 32,
          width: 52, height: 52, borderRadius: '50%', border: 'none',
          background: gradients.primary, color: '#fff', fontSize: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: shadows.primaryStrong, zIndex: 100,
          transition: 'transform 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <PlusOutlined />
      </button>

      <QuickEntry open={quickEntryOpen} onClose={() => setQuickEntryOpen(false)} ledgerId={currentLedgerId} />
      <CategoryManager open={categoryManagerOpen} onClose={() => setCategoryManagerOpen(false)} />
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} ledgerId={currentLedgerId} />
    </div>
  )
}
