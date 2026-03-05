import { Card, Col, Row, Statistic, theme } from 'antd'
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  DashOutlined,
  FireOutlined,
  CalendarOutlined,
} from '@ant-design/icons'
import type { WeightRecord } from '@/shared/db'
import { useBodyStore } from '../store'
import { calculateStreak, predictDaysToGoal } from '../utils'

interface Props {
  records: WeightRecord[]
  allRecords: WeightRecord[] // 全量记录用于计算连续天数
}

export default function StatsRow({ records, allRecords }: Props) {
  const goalWeight = useBodyStore((s) => s.goalWeight)
  const {
    token: { colorSuccess, colorError, colorWarning },
  } = theme.useToken()

  if (records.length === 0) {
    return null
  }

  const sorted = [...records].sort((a, b) => a.createdAt - b.createdAt)
  const latest = sorted[sorted.length - 1]!
  const weights = records.map((r) => r.weight)
  const avg = +(weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1)
  const min = Math.min(...weights)
  const max = Math.max(...weights)

  // 周趋势：最近 7 天 vs 前 7 天
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

  const colSpan = { xs: 12, sm: 8, md: 4 }

  return (
    <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
      <Col {...colSpan}>
        <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
          <Statistic title="最新" value={latest.weight} suffix="kg" precision={1} valueStyle={{ fontSize: 20 }} />
        </Card>
      </Col>
      <Col {...colSpan}>
        <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
          <Statistic title="平均" value={avg} suffix="kg" precision={1} valueStyle={{ fontSize: 20 }} />
        </Card>
      </Col>
      <Col {...colSpan}>
        <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
          <Statistic title="最轻" value={min} suffix="kg" precision={1} valueStyle={{ fontSize: 20 }} />
        </Card>
      </Col>
      <Col {...colSpan}>
        <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
          <Statistic title="最重" value={max} suffix="kg" precision={1} valueStyle={{ fontSize: 20 }} />
        </Card>
      </Col>
      {latest.bmi != null && (
        <Col {...colSpan}>
          <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
            <Statistic title="BMI" value={latest.bmi} precision={1} valueStyle={{ fontSize: 20 }} />
          </Card>
        </Col>
      )}
      {weekTrend !== null && (
        <Col {...colSpan}>
          <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
            <Statistic
              title="周趋势"
              value={Math.abs(weekTrend)}
              precision={1}
              suffix="kg"
              valueStyle={{ fontSize: 20 }}
              prefix={
                weekTrend > 0 ? (
                  <ArrowUpOutlined style={{ color: colorError }} />
                ) : weekTrend < 0 ? (
                  <ArrowDownOutlined style={{ color: colorSuccess }} />
                ) : (
                  <DashOutlined />
                )
              }
            />
          </Card>
        </Col>
      )}
      {gap !== null && (
        <Col {...colSpan}>
          <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
            <Statistic
              title="距目标"
              value={Math.abs(gap)}
              precision={1}
              suffix="kg"
              valueStyle={{ color: gap <= 0 ? colorSuccess : colorError, fontSize: 20 }}
              prefix={gap > 0 ? '+' : gap < 0 ? '-' : ''}
            />
          </Card>
        </Col>
      )}
      {streak > 0 && (
        <Col {...colSpan}>
          <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
            <Statistic
              title="连续记录"
              value={streak}
              suffix="天"
              valueStyle={{ fontSize: 20, color: streak >= 7 ? colorSuccess : undefined }}
              prefix={<FireOutlined style={{ color: colorWarning }} />}
            />
          </Card>
        </Col>
      )}
      {daysToGoal !== null && (
        <Col {...colSpan}>
          <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
            <Statistic
              title="预计达标"
              value={daysToGoal}
              suffix="天"
              valueStyle={{ fontSize: 20 }}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
      )}
    </Row>
  )
}
