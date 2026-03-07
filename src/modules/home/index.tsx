import { useState, useMemo } from 'react'
import { Card, Space, Typography, Progress, InputNumber, Button, Grid, message, theme } from 'antd'
import { HeartOutlined, PlusOutlined, ArrowUpOutlined, ArrowDownOutlined, FireOutlined, CheckCircleOutlined, EnvironmentOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import dayjs from 'dayjs'
import { useDb } from '@/shared/db/context'
import { useDataChanged } from '@/shared/sync/useDataChanged'
import type { Trip, TripSpot } from '@/shared/db'
import TravelYearMap from '@/modules/travel/components/TravelYearMap'

const { Text } = Typography
const { useBreakpoint } = Grid

/** 迷你折线图（纯 SVG） */
function MiniSparkline({ values, color, width = 140, height = 40 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pad = 2
  const points = values.map((v, i) =>
    `${pad + (i / (values.length - 1)) * (width - pad * 2)},${pad + (1 - (v - min) / range) * (height - pad * 2)}`,
  ).join(' ')
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" points={points} />
    </svg>
  )
}

export default function Home() {
  const db = useDb()
  const navigate = useNavigate()
  const notifyChanged = useDataChanged()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const { token: { colorPrimary, colorSuccess, colorError, colorWarning } } = theme.useToken()

  const [quickWeight, setQuickWeight] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const records = useLiveQuery(() =>
    db.weightRecords.orderBy('createdAt').toArray(),
    [db],
  ) ?? []

  const trips = useLiveQuery(() =>
    db.trips.orderBy('startDate').reverse().toArray(),
    [db],
  ) ?? []

  const allSpots = useLiveQuery(() => db.tripSpots.toArray(), [db]) ?? []

  const heightVal = useLiveQuery(async () => {
    const item = await db.kv.get('body_height')
    return (item?.value as number) ?? null
  }, [db])

  const goalWeight = useLiveQuery(async () => {
    const item = await db.kv.get('body_goalWeight')
    return (item?.value as number) ?? null
  }, [db])

  const today = dayjs().format('YYYY-MM-DD')
  const todayRecords = records.filter((r) => r.date === today)
  const hasRecordToday = todayRecords.length > 0

  const sorted = useMemo(
    () => [...records].sort((a, b) => a.createdAt - b.createdAt),
    [records],
  )
  const latest = sorted.length > 0 ? sorted[sorted.length - 1]! : null

  // 近 14 条的体重做迷你折线
  const sparkValues = useMemo(() => {
    return sorted.slice(-14).map((r) => r.weight)
  }, [sorted])

  // 趋势：对比最近 2 条
  const trend = sorted.length >= 2
    ? +(sorted[sorted.length - 1]!.weight - sorted[sorted.length - 2]!.weight).toFixed(1)
    : null

  // 连续记录天数
  const streak = useMemo(() => {
    if (records.length === 0) return 0
    const dates = new Set(records.map((r) => r.date))
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    let count = 0
    for (; ; d.setDate(d.getDate() - 1)) {
      const key = d.toISOString().slice(0, 10)
      if (dates.has(key)) { count++ }
      else { if (count === 0 && key === today) continue; break }
    }
    return count
  }, [records, today])

  // 目标进度
  const progress = useMemo(() => {
    if (goalWeight == null || latest == null || sorted.length < 2) return null
    const first = sorted[0]!.weight
    const current = latest.weight
    const total = first - goalWeight
    if (Math.abs(total) < 0.1) return null
    const done = first - current
    return Math.min(100, Math.max(0, Math.round((done / total) * 100)))
  }, [goalWeight, latest, sorted])

  const handleQuickSubmit = async () => {
    if (!quickWeight || submitting) return
    setSubmitting(true)
    const period = new Date().getHours() < 14 ? 'morning' : 'evening'
    const bmi = heightVal ? +(quickWeight / (heightVal / 100) ** 2).toFixed(1) : undefined

    await db.weightRecords.add({
      date: today,
      period: period as 'morning' | 'evening',
      weight: quickWeight,
      bmi,
      createdAt: Date.now(),
    })
    notifyChanged()
    setQuickWeight(null)
    setSubmitting(false)
    message.success('记录成功')
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {/* 今日提醒 */}
      {!hasRecordToday && records.length > 0 && (
        <Card size="small" style={{ background: '#fffbe6', borderColor: '#ffe58f' }}>
          <Text type="warning">今天还没有记录体重哦，记得称重~</Text>
        </Card>
      )}

      {/* 身材概览 */}
      <Card
        hoverable
        onClick={() => navigate('/body-management')}
        styles={{ body: { padding: isMobile ? 16 : 20 } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Space>
            <HeartOutlined style={{ color: colorError, fontSize: 18 }} />
            <Text strong style={{ fontSize: 16 }}>身材管理</Text>
          </Space>
          {streak > 0 && (
            <Space size={4}>
              <FireOutlined style={{ color: colorWarning }} />
              <Text type="secondary" style={{ fontSize: 13 }}>连续 {streak} 天</Text>
            </Space>
          )}
        </div>

        {latest ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: colorPrimary, lineHeight: 1.2 }}>
                {latest.weight}
                <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 2 }}>kg</span>
              </div>
              {trend !== null && trend !== 0 && (
                <div style={{ fontSize: 13, marginTop: 2 }}>
                  {trend < 0 ? (
                    <Text type="success"><ArrowDownOutlined /> {Math.abs(trend)}kg</Text>
                  ) : (
                    <Text type="danger"><ArrowUpOutlined /> +{trend}kg</Text>
                  )}
                  <Text type="secondary" style={{ marginLeft: 4 }}>vs 上次</Text>
                </div>
              )}
              {latest.bmi != null && (
                <Text type="secondary" style={{ fontSize: 12 }}>BMI {latest.bmi}</Text>
              )}
            </div>

            <MiniSparkline values={sparkValues} color={colorPrimary} width={isMobile ? 120 : 160} height={44} />

            {progress !== null && (
              <div style={{ minWidth: 80 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>目标进度</Text>
                <Progress
                  percent={progress}
                  size="small"
                  strokeColor={progress >= 100 ? colorSuccess : colorPrimary}
                  format={(p) => `${p}%`}
                />
              </div>
            )}
          </div>
        ) : (
          <Text type="secondary">暂无数据，点击前往记录</Text>
        )}

        {hasRecordToday && (
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <CheckCircleOutlined style={{ color: colorSuccess }} /> 今日已记录
            </Text>
          </div>
        )}
      </Card>

      {/* 快捷录入 */}
      <Card size="small" title="快捷录入" styles={{ body: { padding: '12px 16px' } }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <InputNumber
            value={quickWeight}
            onChange={(v) => setQuickWeight(v)}
            min={20}
            max={300}
            step={0.1}
            precision={1}
            placeholder="体重 kg"
            style={{ flex: 1 }}
            onPressEnter={handleQuickSubmit}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleQuickSubmit} loading={submitting}>
            记录
          </Button>
        </div>
        <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
          自动记录为今天 {new Date().getHours() < 14 ? '早晨' : '晚上'}
        </Text>
      </Card>

      {/* 旅行概览 */}
      <TravelSummaryCard trips={trips} spots={allSpots} onNavigate={() => navigate('/travel')} isMobile={isMobile} />
    </Space>
  )
}

/** Travel summary card for home page */
function TravelSummaryCard({ trips, spots, onNavigate, isMobile }: {
  trips: Trip[]; spots: TripSpot[]; onNavigate: () => void; isMobile: boolean
}) {

  const totalTrips = trips.length
  const destinations = new Set(trips.map(t => t.destination)).size
  const photoCount = spots.reduce((n, s) => n + s.photos.length, 0)
  const today = new Date().toISOString().slice(0, 10)

  // Find next upcoming or current trip
  const activeTrip = trips.find(t => t.endDate >= today)
  const isOngoing = activeTrip && activeTrip.startDate <= today
  const isUpcoming = activeTrip && activeTrip.startDate > today

  let statusText = ''
  if (isOngoing && activeTrip) {
    const dayNum = Math.floor((new Date(today + 'T00:00:00').getTime() - new Date(activeTrip.startDate + 'T00:00:00').getTime()) / 86_400_000) + 1
    statusText = `${activeTrip.title} · Day ${dayNum}`
  } else if (isUpcoming && activeTrip) {
    const daysUntil = Math.ceil((new Date(activeTrip.startDate + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000)
    statusText = `${activeTrip.title} · ${daysUntil}天后出发`
  }

  // Recent trip (most recent completed)
  const recentTrip = trips.find(t => t.endDate < today)

  return (
    <Card
      hoverable
      onClick={onNavigate}
      styles={{ body: { padding: isMobile ? 16 : 20 } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Space>
          <EnvironmentOutlined style={{ color: '#F5722D', fontSize: 18 }} />
          <Text strong style={{ fontSize: 16 }}>旅行足迹</Text>
        </Space>
        {statusText && (
          <span style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 10,
            background: isOngoing ? '#ECFDF5' : '#EFF6FF',
            color: isOngoing ? '#059669' : '#2563EB',
            fontWeight: 600,
          }}>
            {statusText}
          </span>
        )}
      </div>

      {totalTrips > 0 ? (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#F5722D', lineHeight: 1.2 }}>
                {totalTrips}
                <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 2 }}>次旅行</span>
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {destinations} 个目的地 · {photoCount} 张照片
              </Text>
            </div>
          </div>

          {recentTrip && (
            <div style={{
              flex: 1, minWidth: 140,
              padding: '8px 12px', borderRadius: 12,
              background: 'linear-gradient(135deg, #FFF7E6, #FFE8D5)',
            }}>
              <Text type="secondary" style={{ fontSize: 10 }}>最近旅行</Text>
              <div style={{
                fontSize: 13, fontWeight: 600, color: '#1a1a1a',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {recentTrip.title}
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {recentTrip.destination} · {recentTrip.startDate.slice(5).replace('-', '.')}
              </Text>
            </div>
          )}
        </div>

        {/* Travel Year Heatmap */}
        <div style={{ marginTop: 12 }} onClick={e => e.stopPropagation()}>
          <TravelYearMap trips={trips} />
        </div>
      </>
      ) : (
        <Text type="secondary">还没有旅行记录，点击开始记录</Text>
      )}
    </Card>
  )
}
