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
import { seedDefaultCategories, seedDefaultLedger, getMonthRange } from './utils'
import LedgerSelector from './components/LedgerSelector'
import TransactionList from './components/TransactionList'
import CalendarView from './components/CalendarView'
import StatsCharts from './components/StatsCharts'
import BudgetManager from './components/BudgetManager'
import CategoryManager from './components/CategoryManager'
import QuickEntry from './components/QuickEntry'
import ExportModal from './components/ExportModal'

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

  // Summary data
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

  const ymLabel = `${yearMonth.split('-')[0]}年${Number(yearMonth.split('-')[1])}月`

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
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '0 0 10px' : '0 0 12px',
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#18181B', letterSpacing: '-0.02em', margin: 0 }}>
          账单明细
        </h1>
        <div style={{ display: 'flex', gap: 4 }}>
          <LedgerSelector value={currentLedgerId} onChange={setLedgerId} />
          <Dropdown menu={{ items: settingsMenuItems, onClick: handleSettingsClick }}>
            <Button type="text" size="small" icon={<SettingOutlined />} />
          </Dropdown>
        </div>
      </div>

      {/* Dark hero card */}
      <div style={{
        background: '#18181B', borderRadius: 20, padding: isMobile ? '20px 20px 16px' : '24px 24px 20px',
        color: '#fff', marginBottom: isMobile ? 10 : 14, position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative blurs */}
        <div style={{
          position: 'absolute', right: -40, top: -40, width: 160, height: 160,
          background: 'rgba(255,255,255,0.05)', borderRadius: '50%', filter: 'blur(40px)',
        }} />
        <div style={{
          position: 'absolute', left: -40, bottom: -40, width: 130, height: 130,
          background: 'rgba(99,102,241,0.15)', borderRadius: '50%', filter: 'blur(40px)',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Month selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
            <Button type="text" size="small" icon={<LeftOutlined />} onClick={prevMonth}
              style={{ color: '#71717A' }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: '#A1A1AA' }}>{ymLabel}总支出</span>
            <Button type="text" size="small" icon={<RightOutlined />} onClick={nextMonth}
              style={{ color: '#71717A' }} />
          </div>

          {/* Total expense - hero number */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 16 }}>
            <span style={{ fontSize: 18, fontWeight: 500, color: '#A1A1AA' }}>¥</span>
            <span style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em' }}>
              {expense.toFixed(2)}
            </span>
          </div>

          {/* Income + balance row */}
          <div style={{
            display: 'flex', gap: 32,
            paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#71717A', marginBottom: 4 }}>总收入</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#34D399' }}>¥ {income.toFixed(2)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#71717A', marginBottom: 4 }}>结余</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#F4F4F5' }}>
                ¥ {(income - expense).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>

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
          background: '#18181B', color: '#fff', fontSize: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: '0 6px 20px rgba(24,24,27,0.3)',
          zIndex: 100, transition: 'transform 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
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
