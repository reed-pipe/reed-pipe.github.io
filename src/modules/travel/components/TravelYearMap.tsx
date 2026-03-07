import { useMemo } from 'react'
import { Typography } from 'antd'
import type { Trip } from '@/shared/db'
import { tripDays, T } from '../utils'
import { colors } from '@/shared/theme'

const { Text } = Typography

interface Props {
  trips: Trip[]
}

function getTravelDates(trips: Trip[]): Set<string> {
  const dates = new Set<string>()
  for (const t of trips) {
    const start = new Date(t.startDate + 'T00:00:00')
    const end = new Date(t.endDate + 'T00:00:00')
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.add(d.toISOString().slice(0, 10))
    }
  }
  return dates
}

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

function YearHeatmap({ year, travelDates }: { year: number; travelDates: Set<string> }) {
  const { weeks, monthPositions } = useMemo(() => {
    const result: { date: string; isTravel: boolean; isInYear: boolean }[][] = []
    const jan1 = new Date(year, 0, 1)
    const dec31 = new Date(year, 11, 31)

    const startDate = new Date(jan1)
    startDate.setDate(startDate.getDate() - startDate.getDay())

    let current = new Date(startDate)
    let currentWeek: { date: string; isTravel: boolean; isInYear: boolean }[] = []
    const months: { month: number; weekIdx: number }[] = []
    let lastMonth = -1

    while (current <= dec31 || currentWeek.length > 0) {
      const dateStr = current.toISOString().slice(0, 10)
      const isInYear = current.getFullYear() === year

      if (isInYear && current.getMonth() !== lastMonth) {
        months.push({ month: current.getMonth(), weekIdx: result.length })
        lastMonth = current.getMonth()
      }

      currentWeek.push({
        date: dateStr,
        isTravel: isInYear && travelDates.has(dateStr),
        isInYear,
      })

      if (currentWeek.length === 7) {
        result.push(currentWeek)
        currentWeek = []
        if (current > dec31) break
      }
      current.setDate(current.getDate() + 1)
    }
    if (currentWeek.length > 0) result.push(currentWeek)
    return { weeks: result, monthPositions: months }
  }, [year, travelDates])

  const cellSize = 14
  const gap = 2
  const totalWidth = weeks.length * (cellSize + gap)

  return (
    <div>
      {/* Month labels */}
      <div style={{ display: 'flex', position: 'relative', height: 16, marginBottom: 2 }}>
        {monthPositions.map(({ month, weekIdx }) => (
          <span
            key={month}
            style={{
              position: 'absolute',
              left: weekIdx * (cellSize + gap),
              fontSize: 10,
              color: colors.textTertiary,
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            {MONTH_LABELS[month]}
          </span>
        ))}
      </div>
      <div style={{
        display: 'flex', gap, overflow: 'auto', paddingBottom: 4,
        minWidth: totalWidth,
      }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap }}>
            {week.map((day, di) => (
              <div
                key={di}
                title={day.isInYear ? day.date : ''}
                style={{
                  width: cellSize,
                  height: cellSize,
                  borderRadius: 3,
                  background: !day.isInYear
                    ? 'transparent'
                    : day.isTravel
                      ? colors.primary
                      : 'rgba(0,0,0,0.05)',
                  boxShadow: day.isTravel ? `0 1px 3px rgba(245,114,45,0.3)` : undefined,
                  transition: 'all 0.2s',
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function YearBarChart({ yearData }: { yearData: { year: string; count: number; days: number }[] }) {
  if (yearData.length === 0) return null
  const maxDays = Math.max(...yearData.map(y => y.days), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {yearData.map(y => (
        <div key={y.year} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 12, width: 36, textAlign: 'right', flexShrink: 0, fontWeight: 600, color: colors.textSecondary }}>
            {y.year}
          </Text>
          <div style={{
            flex: 1, height: 24, borderRadius: 8,
            background: colors.bg, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.max(20, (y.days / maxDays) * 100)}%`,
              borderRadius: 8,
              background: T.gradient,
              display: 'flex', alignItems: 'center',
              paddingLeft: 10,
              transition: 'width 0.6s ease',
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25)`,
            }}>
              <Text style={{ fontSize: 11, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {y.count}次 {y.days}天
              </Text>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function TravelYearMap({ trips }: Props) {
  const travelDates = useMemo(() => getTravelDates(trips), [trips])

  const currentYear = new Date().getFullYear()
  const travelDaysThisYear = useMemo(() => {
    let count = 0
    travelDates.forEach(d => { if (d.startsWith(String(currentYear))) count++ })
    return count
  }, [travelDates, currentYear])

  const yearData = useMemo(() => {
    const map = new Map<string, { count: number; days: number }>()
    for (const t of trips) {
      const year = t.startDate.slice(0, 4)
      const entry = map.get(year) ?? { count: 0, days: 0 }
      entry.count++
      entry.days += tripDays(t.startDate, t.endDate)
      map.set(year, entry)
    }
    return [...map.entries()]
      .map(([year, data]) => ({ year, ...data }))
      .sort((a, b) => b.year.localeCompare(a.year))
  }, [trips])

  if (trips.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text strong style={{ fontSize: 13 }}>{currentYear} 旅行日历</Text>
          <div style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 8,
            background: colors.primaryBg,
            color: colors.primary,
            fontWeight: 600,
          }}>
            {travelDaysThisYear} 天
          </div>
        </div>
        <div style={{
          padding: 14, borderRadius: 14,
          background: colors.bg,
          border: `1px solid ${colors.borderLight}`,
          overflow: 'auto',
        }}>
          <YearHeatmap year={currentYear} travelDates={travelDates} />
        </div>
      </div>

      {yearData.length > 1 && (
        <div>
          <Text strong style={{ fontSize: 13, marginBottom: 10, display: 'block' }}>历年旅行</Text>
          <YearBarChart yearData={yearData} />
        </div>
      )}
    </div>
  )
}
