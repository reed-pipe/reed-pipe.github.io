import { useMemo, useState, useCallback, useRef } from 'react'
import { Grid } from 'antd'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDb } from '@/shared/db/context'
import { getMonthRange, formatAmount } from '../utils'
import { colors } from '@/shared/theme'

const { useBreakpoint } = Grid

interface Props {
  ledgerId: number
  yearMonth: string
  onSelectDate?: (date: string) => void
}

export default function CalendarView({ ledgerId, yearMonth, onSelectDate }: Props) {
  const db = useDb()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const { start, end } = useMemo(() => getMonthRange(yearMonth), [yearMonth])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const transactions = useLiveQuery(
    () => db.accTransactions
      .where('[ledgerId+date]')
      .between([ledgerId, start], [ledgerId, end + '\uffff'])
      .toArray(),
    [db, ledgerId, start, end],
  ) ?? []

  const dailySums = useMemo(() => {
    const map = new Map<string, { expense: number; income: number }>()
    for (const t of transactions) {
      const entry = map.get(t.date) ?? { expense: 0, income: 0 }
      if (t.type === 'expense') entry.expense += t.amount
      else entry.income += t.amount
      map.set(t.date, entry)
    }
    return map
  }, [transactions])

  const [year, month] = yearMonth.split('-').map(Number) as [number, number]
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const today = new Date().toISOString().slice(0, 10)

  const weeks: (number | null)[][] = []
  let currentWeek: (number | null)[] = Array(firstDay).fill(null)

  for (let d = 1; d <= daysInMonth; d++) {
    currentWeek.push(d)
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null)
    weeks.push(currentWeek)
  }

  // Responsive: measure container width
  const [containerWidth, setContainerWidth] = useState(354)
  const roRef = useRef<ResizeObserver | null>(null)
  const measuredRef = useCallback((node: HTMLDivElement | null) => {
    if (roRef.current) { roRef.current.disconnect(); roRef.current = null }
    if (node) {
      const w = node.getBoundingClientRect().width
      if (w > 0) setContainerWidth(w)
      const ro = new ResizeObserver(entries => {
        const e = entries[0]
        if (e && e.contentRect.width > 0) setContainerWidth(e.contentRect.width)
      })
      ro.observe(node)
      roRef.current = ro
    }
  }, [])

  const GAP = 2
  const CELL_SIZE = Math.floor((containerWidth - 6 * GAP) / 7)
  const WIDTH = 7 * CELL_SIZE + 6 * GAP
  const HEADER_H = isMobile ? 20 : 24
  const ROW_H = isMobile ? Math.max(34, CELL_SIZE * 0.95) : Math.max(44, CELL_SIZE * 1.15)
  const fontSize = CELL_SIZE < 40 ? 8 : 9

  const weekDays = ['日', '一', '二', '三', '四', '五', '六']

  const handleDateClick = (dateStr: string) => {
    setSelectedDate(dateStr)
    onSelectDate?.(dateStr)
  }

  return (
    <div ref={measuredRef} style={{ width: '100%' }}>
      <svg
        width={WIDTH}
        height={HEADER_H + weeks.length * (ROW_H + GAP)}
        style={{ display: 'block', margin: '0 auto' }}
      >
        {/* Weekday headers */}
        {weekDays.map((w, i) => (
          <text
            key={w}
            x={i * (CELL_SIZE + GAP) + CELL_SIZE / 2}
            y={HEADER_H - 6}
            textAnchor="middle"
            fontSize={isMobile ? 11 : 12}
            fill={colors.textTertiary}
          >
            {w}
          </text>
        ))}

        {/* Calendar cells */}
        {weeks.map((week, wi) =>
          week.map((day, di) => {
            if (day === null) return null
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const sums = dailySums.get(dateStr)
            const isToday = dateStr === today
            const isSelected = dateStr === selectedDate
            const x = di * (CELL_SIZE + GAP)
            const y = HEADER_H + wi * (ROW_H + GAP)

            return (
              <g
                key={`${wi}-${di}`}
                onClick={() => handleDateClick(dateStr)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={x} y={y}
                  width={CELL_SIZE} height={ROW_H}
                  rx={8} ry={8}
                  fill={isSelected ? `${colors.primary}18` : isToday ? `${colors.primary}10` : sums ? '#FAFAFA' : 'transparent'}
                  stroke={isSelected ? colors.primary : isToday ? colors.primary : 'transparent'}
                  strokeWidth={isSelected ? 2 : isToday ? 1.5 : 0}
                />

                {/* Day number */}
                <text
                  x={x + CELL_SIZE / 2}
                  y={y + (isMobile ? 13 : 15)}
                  textAnchor="middle"
                  fontSize={isMobile ? 12 : 13}
                  fontWeight={isToday || isSelected ? 700 : 400}
                  fill={isSelected ? colors.primary : isToday ? colors.primary : colors.text}
                >
                  {day}
                </text>

                {/* Expense */}
                {sums && sums.expense > 0 && (
                  <text
                    x={x + CELL_SIZE / 2}
                    y={y + ROW_H * 0.55}
                    textAnchor="middle"
                    fontSize={fontSize}
                    fill={colors.danger}
                  >
                    -{formatAmount(sums.expense)}
                  </text>
                )}

                {/* Income */}
                {sums && sums.income > 0 && (
                  <text
                    x={x + CELL_SIZE / 2}
                    y={y + ROW_H * 0.8}
                    textAnchor="middle"
                    fontSize={fontSize}
                    fill={colors.success}
                  >
                    +{formatAmount(sums.income)}
                  </text>
                )}
              </g>
            )
          }),
        )}
      </svg>
      {/* Hint */}
      <div style={{ textAlign: 'center', fontSize: 11, color: colors.textTertiary, marginTop: 6 }}>
        点击日期查看当日明细
      </div>
    </div>
  )
}
