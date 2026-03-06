import { Card, Tag, Rate, Typography, Space, Button, theme } from 'antd'
import { EnvironmentOutlined, CalendarOutlined, NodeIndexOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'
import type { Trip } from '@/shared/db'
import { formatDateRange, tripDays, formatCost } from '../utils'

const { Text, Paragraph } = Typography

interface Props {
  trip: Trip
  onClick: () => void
  onPlayRoute?: () => void
  hasCoords?: boolean
}

const TAG_COLORS: Record<string, string> = {
  '自驾': 'blue',
  '徒步': 'green',
  '出差': 'orange',
  '亲子': 'magenta',
  '自由行': 'cyan',
  '跟团': 'purple',
  '露营': 'lime',
  '美食': 'red',
}

export default function TripCard({ trip, onClick, onPlayRoute, hasCoords }: Props) {
  const { token: { colorBgLayout, colorTextSecondary } } = theme.useToken()
  const days = tripDays(trip.startDate, trip.endDate)

  const coverContent = trip.coverPhoto ? (
    <div style={{ height: 200, overflow: 'hidden', position: 'relative' }}>
      <motion.img
        src={trip.coverPhoto}
        alt={trip.title}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        whileHover={{ scale: 1.06 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
      {/* Gradient overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)',
          opacity: 0,
          transition: 'opacity 0.3s',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '12px 16px',
          pointerEvents: 'none',
        }}
        className="trip-card-overlay"
      />
      {hasCoords && onPlayRoute && (
        <Button
          type="primary"
          size="small"
          icon={<NodeIndexOutlined />}
          style={{
            position: 'absolute', bottom: 8, right: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)', fontSize: 12,
          }}
          onClick={(e) => { e.stopPropagation(); onPlayRoute() }}
        >
          路线
        </Button>
      )}
    </div>
  ) : (
    <div
      style={{
        height: 200, background: colorBgLayout, position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <EnvironmentOutlined style={{ fontSize: 40, color: colorTextSecondary }} />
      {hasCoords && onPlayRoute && (
        <Button
          type="primary"
          size="small"
          icon={<NodeIndexOutlined />}
          style={{
            position: 'absolute', bottom: 8, right: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)', fontSize: 12,
          }}
          onClick={(e) => { e.stopPropagation(); onPlayRoute() }}
        >
          路线
        </Button>
      )}
    </div>
  )

  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
      transition={{ duration: 0.25 }}
      style={{ borderRadius: 12, overflow: 'hidden' }}
    >
      <Card
        hoverable
        onClick={onClick}
        cover={coverContent}
        styles={{ body: { padding: '12px 16px' } }}
        style={{ borderRadius: 12, overflow: 'hidden' }}
      >
        <Paragraph strong ellipsis style={{ fontSize: 15, marginBottom: 4, fontFamily: "'Inter', sans-serif" }}>
          {trip.title}
        </Paragraph>
        <Space size={4} style={{ marginBottom: 4 }}>
          <EnvironmentOutlined style={{ color: colorTextSecondary, fontSize: 12 }} />
          <Text type="secondary" style={{ fontSize: 13 }}>
            {trip.departureName && `${trip.departureName} → `}{trip.destination}
          </Text>
        </Space>
        <div style={{ marginBottom: 6 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <CalendarOutlined /> {formatDateRange(trip.startDate, trip.endDate)} · {days}天
          </Text>
        </div>
        {trip.rating != null && trip.rating > 0 && (
          <Rate disabled value={trip.rating} style={{ fontSize: 12, marginBottom: 6 }} />
        )}
        {trip.totalCost != null && trip.totalCost > 0 && (
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
            {formatCost(trip.totalCost)}
          </Text>
        )}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {trip.tags.map((tag) => (
            <Tag key={tag} color={TAG_COLORS[tag] ?? 'default'} style={{ margin: 0, fontSize: 11 }}>
              {tag}
            </Tag>
          ))}
        </div>
      </Card>
    </motion.div>
  )
}
