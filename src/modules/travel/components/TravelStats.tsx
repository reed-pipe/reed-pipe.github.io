import { Card, Col, Row, Statistic, theme } from 'antd'
import {
  EnvironmentOutlined,
  CalendarOutlined,
  DollarOutlined,
  FlagOutlined,
  PushpinOutlined,
} from '@ant-design/icons'
import type { Trip, TripSpot } from '@/shared/db'
import { computeStats } from '../utils'

interface Props {
  trips: Trip[]
  spots: TripSpot[]
}

export default function TravelStats({ trips, spots }: Props) {
  const { token: { colorPrimary } } = theme.useToken()

  if (trips.length === 0) return null

  const stats = computeStats(trips, spots)
  const colSpan = { xs: 12, sm: 8, md: 4 }

  return (
    <Row gutter={[8, 8]}>
      <Col {...colSpan}>
        <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
          <Statistic
            title="旅行"
            value={stats.totalTrips}
            suffix="次"
            valueStyle={{ fontSize: 20 }}
            prefix={<FlagOutlined style={{ color: colorPrimary }} />}
          />
        </Card>
      </Col>
      <Col {...colSpan}>
        <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
          <Statistic
            title="目的地"
            value={stats.destinations}
            suffix="个"
            valueStyle={{ fontSize: 20 }}
            prefix={<EnvironmentOutlined style={{ color: colorPrimary }} />}
          />
        </Card>
      </Col>
      <Col {...colSpan}>
        <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
          <Statistic
            title="总天数"
            value={stats.totalDays}
            suffix="天"
            valueStyle={{ fontSize: 20 }}
            prefix={<CalendarOutlined style={{ color: colorPrimary }} />}
          />
        </Card>
      </Col>
      <Col {...colSpan}>
        <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
          <Statistic
            title="打卡点"
            value={stats.totalSpots}
            suffix="个"
            valueStyle={{ fontSize: 20 }}
            prefix={<PushpinOutlined style={{ color: colorPrimary }} />}
          />
        </Card>
      </Col>
      {stats.totalCost > 0 && (
        <Col {...colSpan}>
          <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
            <Statistic
              title="总花费"
              value={stats.totalCost}
              prefix={<DollarOutlined style={{ color: '#faad14' }} />}
              suffix="元"
              valueStyle={{ fontSize: 20 }}
            />
          </Card>
        </Col>
      )}
    </Row>
  )
}
