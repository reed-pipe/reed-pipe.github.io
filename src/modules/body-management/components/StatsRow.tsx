import { Card, Col, Row, Statistic, theme } from 'antd'
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  DashOutlined,
} from '@ant-design/icons'
import type { WeightRecord } from '@/shared/db'
import { useBodyStore } from '../store'

interface Props {
  records: WeightRecord[]
}

export default function StatsRow({ records }: Props) {
  const goalWeight = useBodyStore((s) => s.goalWeight)
  const {
    token: { colorSuccess, colorError },
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

  // 周趋势：最近 7 天 vs 前 7 天（基于记录日期而非创建时间）
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

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={12} sm={8} md={4}>
        <Card size="small">
          <Statistic title="最新体重" value={latest.weight} suffix="kg" precision={1} />
        </Card>
      </Col>
      <Col xs={12} sm={8} md={4}>
        <Card size="small">
          <Statistic title="平均体重" value={avg} suffix="kg" precision={1} />
        </Card>
      </Col>
      <Col xs={12} sm={8} md={4}>
        <Card size="small">
          <Statistic title="最轻" value={min} suffix="kg" precision={1} />
        </Card>
      </Col>
      <Col xs={12} sm={8} md={4}>
        <Card size="small">
          <Statistic title="最重" value={max} suffix="kg" precision={1} />
        </Card>
      </Col>
      {latest.bmi != null && (
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="最新 BMI" value={latest.bmi} precision={1} />
          </Card>
        </Col>
      )}
      {weekTrend !== null && (
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic
              title="周趋势"
              value={Math.abs(weekTrend)}
              precision={1}
              suffix="kg"
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
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic
              title="距目标"
              value={Math.abs(gap)}
              precision={1}
              suffix="kg"
              valueStyle={{ color: gap <= 0 ? colorSuccess : colorError }}
              prefix={gap > 0 ? '+' : gap < 0 ? '-' : ''}
            />
          </Card>
        </Col>
      )}
    </Row>
  )
}
