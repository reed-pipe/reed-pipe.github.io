import { useState, useEffect, useCallback } from 'react'
import { Tabs, Button, Grid, Dropdown, message } from 'antd'
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
import { seedDefaultCategories, seedDefaultLedger, exportAccountingCSV } from './utils'
import LedgerSelector from './components/LedgerSelector'
import MonthlySummary from './components/MonthlySummary'
import TransactionList from './components/TransactionList'
import CalendarView from './components/CalendarView'
import StatsCharts from './components/StatsCharts'
import BudgetManager from './components/BudgetManager'
import CategoryManager from './components/CategoryManager'
import QuickEntry from './components/QuickEntry'
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
  }
  const nextMonth = () => {
    setYearMonth(dayjs(yearMonth + '-01').add(1, 'month').format('YYYY-MM'))
  }

  const handleCalendarDateSelect = (date: string) => {
    // Could switch to TransactionList tab filtered by date in the future
    setYearMonth(date.slice(0, 7))
  }

  const handleExport = async () => {
    const [transactions, categories] = await Promise.all([
      db.accTransactions.where('ledgerId').equals(currentLedgerId).toArray(),
      db.accCategories.toArray(),
    ])
    const csv = exportAccountingCSV(transactions, categories)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `记账_${yearMonth}.csv`
    a.click()
    URL.revokeObjectURL(url)
    message.success('导出成功')
  }

  const settingsMenuItems = [
    { key: 'categories', label: '分类管理', icon: <AppstoreOutlined /> },
    { key: 'export', label: '导出 CSV', icon: <DownloadOutlined /> },
  ]

  const handleSettingsClick = ({ key }: { key: string }) => {
    if (key === 'categories') setCategoryManagerOpen(true)
    if (key === 'export') handleExport()
  }

  if (!currentLedgerId || ledgers.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 8,
      }}>
        <LedgerSelector value={currentLedgerId} onChange={setLedgerId} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Button type="text" size="small" icon={<LeftOutlined />} onClick={prevMonth} />
          <span style={{
            fontSize: 15, fontWeight: 700, color: colors.text,
            minWidth: 80, textAlign: 'center',
          }}>
            {yearMonth.replace('-', '年') + '月'}
          </span>
          <Button type="text" size="small" icon={<RightOutlined />} onClick={nextMonth} />
        </div>

        <Dropdown menu={{ items: settingsMenuItems, onClick: handleSettingsClick }}>
          <Button type="text" size="small" icon={<SettingOutlined />} />
        </Dropdown>
      </div>

      {/* Monthly summary */}
      <MonthlySummary ledgerId={currentLedgerId} yearMonth={yearMonth} />

      {/* Tabs */}
      <Tabs
        defaultActiveKey="list"
        size={isMobile ? 'small' : 'middle'}
        items={[
          {
            key: 'list',
            label: '明细',
            children: <TransactionList ledgerId={currentLedgerId} yearMonth={yearMonth} />,
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
          right: isMobile ? 20 : 32,
          bottom: isMobile ? 24 : 32,
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: 'none',
          background: gradients.primary,
          color: '#fff',
          fontSize: 24,
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
    </div>
  )
}
