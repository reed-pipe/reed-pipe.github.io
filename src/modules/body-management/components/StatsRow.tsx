import { theme } from 'antd'
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  DashOutlined,
  FireOutlined,
  CalendarOutlined,
} from '@ant-design/icons'
import type { WeightRecord } from '@/shared/db'
import { useBodyStore } from '../store'
import { calculateStreak, predictDaysToGoal, getBMICategory } from '../utils'
import { colors, shadows } from '@/shared/theme'

interface Props {
  records: WeightRecord[]
  allRecords: WeightRecord[]
}

function StatCard({ title, value, suffix, color, icon }: {
  title: string
  value: string | number
  suffix?: string
  color?: string
  icon?: React.ReactNode
}) {
  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 14,
      background: '#fff',
      border: `1px solid ${colors.borderLight}`,
      boxShadow: shadows.card,
      minWidth: 0,
    }}>
      <div style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon}
        {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: color ?? colors.text, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          {value}
        </span>
        {suffix && <span style={{ fontSize: 12, color: colors.textTertiary }}>{suffix}</span>}
      </div>
    </div>
  )
}

export default function StatsRow({ records, allRecords }: Props) {
  const goalWeight = useBodyStore((s) => s.goalWeight)
  const {
    token: { colorSuccess, colorError, colorWarning },
  } = theme.useToken()

  if (records.length === 0) return null

  const sorted = [...records].sort((a, b) => a.createdAt - b.createdAt)
  const latest = sorted[sorted.length - 1]!
  const weights = records.map((r) => r.weight)
  const avg = +(weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1)
  const min = Math.min(...weights)
  const max = Math.max(...weights)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayMs = today.getTime()
  const msPerDay = 86_400_000
  const dateToMs = (d: string) => new Date(d + 'T00:00:00').getTime()
  const recent7 = records.filter((r) => {
    const diff = todayMs - dateToMs(r.date)
    return diff >= 0 && diff < 7 * msPerDay
  })
  const prev7 = records.filter((r) => {
    const diff = todayMs - dateToMs(r.date)
    return diff >= 7 * msPerDay && diff < 14 * msPerDay
  })
  let weekTrend: number | null = null
  if (recent7.length > 0 && prev7.length > 0) {
    const avgRecent = recent7.reduce((s, r) => s + r.weight, 0) / recent7.length
    const avgPrev = prev7.reduce((s, r) => s + r.weight, 0) / prev7.length
    weekTrend = +(avgRecent - avgPrev).toFixed(1)
  }

  const gap = goalWeight !== null ? +(latest.weight - goalWeight).toFixed(1) : null
  const streak = calculateStreak(allRecords)
  const daysToGoal = predictDaysToGoal(records, goalWeight)

  const cards: { title: string; value: string | number; suffix?: string; color?: string; icon?: React.ReactNode }[] = [
    { title: '最新', value: latest.weight, suffix: 'kg', color: colors.primary },
    { title: '平均', value: avg, suffix: 'kg' },
    { title: '最轻', value: min, suffix: 'kg', color: colors.success },
    { title: '最重', value: max, suffix: 'kg' },
  ]

  if (latest.bmi != null) {
    const cat = getBMICategory(latest.bmi)
    cards.push({ title: `BMI · ${cat.label}`, value: latest.bmi, color: cat.color })
  }

  if (weekTrend !== null) {
    const icon = weekTrend > 0
      ? <ArrowUpOutlined style={{ color: colorError, fontSize: 10 }} />
      : weekTrend < 0
        ? <ArrowDownOutlined style={{ color: colorSuccess, fontSize: 10 }} />
        : <DashOutlined style={{ fontSize: 10 }} />
    cards.push({
      title: '周趋势',
      value: `${weekTrend > 0 ? '+' : ''}${weekTrend}`,
      suffix: 'kg',
      color: weekTrend > 0 ? colorError : weekTrend < 0 ? colorSuccess : undefined,
      icon,
    })
  }

  if (gap !== null) {
    cards.push({
      title: '距目标',
      value: `${gap > 0 ? '-' : gap < 0 ? '+' : ''}${Math.abs(gap)}`,
      suffix: 'kg',
      color: gap <= 0 ? colorSuccess : colorError,
    })
  }

  if (streak > 0) {
    cards.push({
      title: '连续记录',
      value: streak,
      suffix: '天',
      color: streak >= 7 ? colorSuccess : undefined,
      icon: <FireOutlined style={{ color: colorWarning, fontSize: 10 }} />,
    })
  }

  if (daysToGoal !== null) {
    cards.push({
      title: '预计达标',
      value: daysToGoal,
      suffix: '天',
      icon: <CalendarOutlined style={{ fontSize: 10 }} />,
    })
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
      gap: 8,
      marginBottom: 8,
    }}>
      {cards.map((card, i) => (
        <StatCard key={i} {...card} />
      ))}
    </div>
  )
}
