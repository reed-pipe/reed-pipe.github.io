import { useMemo } from 'react'
import { Typography } from 'antd'
import type { Trip } from '@/shared/db'
import { tripDays, T } from '../utils'

const { Text } = Typography

interface Props {
  trips: Trip[]
}

/** Build a set of all dates covered by trips */
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

/** Year heatmap calendar */
function YearHeatmap({ year, travelDates }: { year: number; travelDates: Set<string> }) {
  const weeks = useMemo(() => {
    const result: { date: string; isTravel: boolean; month: number }[][] = []
    const jan1 = new Date(year, 0, 1)
    const dec31 = new Date(year, 11, 31)

    // Start from the Sunday of the week containing Jan 1
    const startDate = new Date(jan1)
    startDate.setDate(startDate.getDate() - startDate.getDay())

    let current = new Date(startDate)
    let currentWeek: { date: string; isTravel: boolean; month: number }[] = []

    while (current <= dec31 || currentWeek.length > 0) {
      const dateStr = current.toISOString().slice(0, 10)
      const isInYear = current.getFullYear() === year
      currentWeek.push({
        date: dateStr,
        isTravel: isInYear && travelDates.has(dateStr),
        month: current.getMonth(),
      })

      if (currentWeek.length === 7) {
        result.push(currentWeek)
        currentWeek = []
        if (current > dec31) break
      }
      current.setDate(current.getDate() + 1)
    }
    if (currentWeek.length > 0) result.push(currentWeek)
    return result
  }, [year, travelDates])

  const cellSize = 11
  const gap = 2

  return (
    <div>
      <div style={{ display: 'flex', gap, overflow: 'auto', paddingBottom: 4 }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap }}>
            {week.map((day, di) => (
              <div
                key={di}
                title={day.date}
                style={{
                  width: cellSize,
                  height: cellSize,
                  borderRadius: 2,
                  background: day.isTravel
                    ? T.primary
                    : 'rgba(0,0,0,0.06)',
                  opacity: day.isTravel ? 1 : 0.5,
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Year bar chart */
function YearBarChart({ yearData }: { yearData: { year: string; count: number; days: number }[] }) {
  if (yearData.length === 0) return null
  const maxDays = Math.max(...yearData.map(y => y.days), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {yearData.map(y => (
        <div key={y.year} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 12, width: 36, textAlign: 'right', flexShrink: 0 }}>{y.year}</Text>
          <div style={{ flex: 1, height: 20, borderRadius: 6, background: 'rgba(0,0,0,0.04)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(y.days / maxDays) * 100}%`,
              borderRadius: 6,
              background: T.gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              paddingRight: 6, minWidth: 40,
              transition: 'width 0.6s ease',
            }}>
              <Text style={{ fontSize: 10, color: '#fff', fontWeight: 600 }}>
                {y.count}次 · {y.days}天
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
      {/* This year heatmap */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text strong style={{ fontSize: 13 }}>{currentYear} 旅行日历</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            今年旅行 {travelDaysThisYear} 天
          </Text>
        </div>
        <div style={{
          padding: 12, borderRadius: 12,
          background: 'rgba(0,0,0,0.02)',
          overflow: 'auto',
        }}>
          <YearHeatmap year={currentYear} travelDates={travelDates} />
        </div>
      </div>

      {/* Year comparison chart */}
      {yearData.length > 1 && (
        <div>
          <Text strong style={{ fontSize: 13, marginBottom: 8, display: 'block' }}>历年旅行</Text>
          <YearBarChart yearData={yearData} />
        </div>
      )}
    </div>
  )
}
