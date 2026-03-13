import { useState, useMemo } from 'react'
import { Typography, Progress, InputNumber, Button, Grid, message } from 'antd'
import { HeartOutlined, PlusOutlined, ArrowUpOutlined, ArrowDownOutlined, FireOutlined, CheckCircleOutlined, EnvironmentOutlined, AccountBookOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import dayjs from 'dayjs'
import { useDb } from '@/shared/db/context'
import { useDataChanged } from '@/shared/sync/useDataChanged'
import type { Trip, TripSpot } from '@/shared/db'
import TravelYearMap from '@/modules/travel/components/TravelYearMap'
import { colors, gradients, shadows } from '@/shared/theme'

const { Text } = Typography
const { useBreakpoint } = Grid

function MiniSparkline({ values, color, width = 140, height = 40 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pad = 2
  const points = values.map((v, i) =>
    `${pad + (i / (values.length - 1)) * (width - pad * 2)},${pad + (1 - (v - min) / range) * (height - pad * 2)}`,
  ).join(' ')
  // Fill area
  const areaPoints = points + ` ${pad + (width - pad * 2)},${height} ${pad},${height}`
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill="url(#sparkFill)" points={areaPoints} />
      <polyline fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={points} />
      {/* Latest point dot */}
      {values.length >= 2 && (() => {
        const lastX = pad + ((values.length - 1) / (values.length - 1)) * (width - pad * 2)
        const lastY = pad + (1 - (values[values.length - 1]! - min) / range) * (height - pad * 2)
        return <circle cx={lastX} cy={lastY} r={3} fill={color} />
      })()}
    </svg>
  )
}

/** Unified section card */
function SectionCard({ children, onClick, style }: {
  children: React.ReactNode
  onClick?: () => void
  style?: React.CSSProperties
}) {
  return (
    <div
      className="card-hover"
      onClick={onClick}
      style={{
        background: '#fff',
        borderRadius: 18,
        padding: 20,
        border: `1px solid ${colors.borderLight}`,
        boxShadow: shadows.card,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export default function Home() {
  const db = useDb()
  const navigate = useNavigate()
  const notifyChanged = useDataChanged()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const [quickWeight, setQuickWeight] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const records = useLiveQuery(() => db.weightRecords.orderBy('createdAt').toArray(), [db]) ?? []
  const trips = useLiveQuery(() => db.trips.orderBy('startDate').reverse().toArray(), [db]) ?? []
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

  const sorted = useMemo(() => [...records].sort((a, b) => a.createdAt - b.createdAt), [records])
  const latest = sorted.length > 0 ? sorted[sorted.length - 1]! : null
  const sparkValues = useMemo(() => sorted.slice(-14).map((r) => r.weight), [sorted])

  const trend = sorted.length >= 2
    ? +(sorted[sorted.length - 1]!.weight - sorted[sorted.length - 2]!.weight).toFixed(1)
    : null

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
    <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Today reminder */}
      {!hasRecordToday && records.length > 0 && (
        <div style={{
          padding: '10px 16px',
          borderRadius: 12,
          background: colors.warningBg,
          border: `1px solid rgba(217, 119, 6, 0.12)`,
          fontSize: 13,
          color: colors.warning,
          fontWeight: 500,
        }}>
          今天还没有记录体重，记得称重~
        </div>
      )}

      {/* Body management */}
      <SectionCard onClick={() => navigate('/body-management')}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'linear-gradient(135deg, #FEE2E2, #FECACA)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <HeartOutlined style={{ color: colors.danger, fontSize: 15 }} />
            </div>
            <Text strong style={{ fontSize: 15 }}>身材管理</Text>
          </div>
          {streak > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 10,
              background: colors.warningBg,
              fontSize: 12, fontWeight: 600, color: colors.warning,
            }}>
              <FireOutlined /> {streak} 天
            </div>
          )}
        </div>

        {latest ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 14 : 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 800, color: colors.primary, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                {latest.weight}
                <span style={{ fontSize: 14, fontWeight: 500, marginLeft: 2, color: colors.textSecondary }}>kg</span>
              </div>
              {trend !== null && trend !== 0 && (
                <div style={{ fontSize: 13, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {trend < 0 ? (
                    <span style={{ color: colors.success, fontWeight: 600 }}><ArrowDownOutlined /> {Math.abs(trend)}kg</span>
                  ) : (
                    <span style={{ color: colors.danger, fontWeight: 600 }}><ArrowUpOutlined /> +{trend}kg</span>
                  )}
                  <span style={{ color: colors.textTertiary }}>vs 上次</span>
                </div>
              )}
              {latest.bmi != null && (
                <Text type="secondary" style={{ fontSize: 12, marginTop: 2, display: 'block' }}>BMI {latest.bmi}</Text>
              )}
            </div>

            <MiniSparkline values={sparkValues} color={colors.primary} width={isMobile ? 120 : 160} height={48} />

            {progress !== null && (
              <div style={{ minWidth: 90 }}>
                <Text type="secondary" style={{ fontSize: 11, marginBottom: 4, display: 'block' }}>目标进度</Text>
                <Progress
                  percent={progress}
                  size="small"
                  strokeColor={progress >= 100 ? colors.success : colors.primary}
                  format={(p) => `${p}%`}
                />
              </div>
            )}
          </div>
        ) : (
          <Text type="secondary">暂无数据，点击前往记录</Text>
        )}

        {hasRecordToday && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircleOutlined style={{ color: colors.success, fontSize: 12 }} />
            <Text type="secondary" style={{ fontSize: 12 }}>今日已记录</Text>
          </div>
        )}

        {/* Inline quick input */}
        <div style={{
          marginTop: 14, paddingTop: 14,
          borderTop: `1px solid ${colors.borderLight}`,
          display: 'flex', gap: 8, alignItems: 'center',
        }}
          onClick={e => e.stopPropagation()}
        >
          <InputNumber
            value={quickWeight}
            onChange={(v) => setQuickWeight(v)}
            min={20} max={300} step={0.1} precision={1}
            placeholder="体重 kg"
            style={{ flex: 1 }}
            onPressEnter={handleQuickSubmit}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleQuickSubmit}
            loading={submitting}
            style={{
              background: gradients.primary,
              border: 'none',
              borderRadius: 10,
              fontWeight: 600,
              boxShadow: shadows.primary,
            }}
          >
            记录
          </Button>
        </div>
        <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
          自动记录为今天{new Date().getHours() < 14 ? '早晨' : '晚上'}
        </Text>
      </SectionCard>

      {/* Accounting summary */}
      <AccountingSummaryCard onNavigate={() => navigate('/accounting')} isMobile={isMobile} />

      {/* Travel summary */}
      <TravelSummaryCard trips={trips} spots={allSpots} onNavigate={() => navigate('/travel')} isMobile={isMobile} />
    </div>
  )
}

function TravelSummaryCard({ trips, spots, onNavigate, isMobile }: {
  trips: Trip[]; spots: TripSpot[]; onNavigate: () => void; isMobile: boolean
}) {
  const totalTrips = trips.length
  const destinations = new Set(trips.map(t => t.destination)).size
  const photoCount = spots.reduce((n, s) => n + s.photos.length, 0)
  const today = new Date().toISOString().slice(0, 10)

  const activeTrip = trips.find(t => t.endDate >= today)
  const isOngoing = activeTrip && activeTrip.startDate <= today
  const isUpcoming = activeTrip && activeTrip.startDate > today

  let statusText = ''
  if (isOngoing && activeTrip) {
    const dayNum = Math.floor((new Date(today + 'T00:00:00').getTime() - new Date(activeTrip.startDate + 'T00:00:00').getTime()) / 86_400_000) + 1
    statusText = `${activeTrip.title} Day ${dayNum}`
  } else if (isUpcoming && activeTrip) {
    const daysUntil = Math.ceil((new Date(activeTrip.startDate + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000)
    statusText = `${activeTrip.title} ${daysUntil}天后`
  }

  const recentTrip = trips.find(t => t.endDate < today)

  return (
    <SectionCard onClick={onNavigate}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: gradients.primaryLight,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <EnvironmentOutlined style={{ color: colors.primary, fontSize: 15 }} />
          </div>
          <Text strong style={{ fontSize: 15 }}>旅行足迹</Text>
        </div>
        {statusText && (
          <span
            className={isOngoing ? 'pulse-glow' : ''}
            style={{
              fontSize: 11, padding: '4px 12px', borderRadius: 10,
              background: isOngoing ? colors.successBg : colors.accentBg,
              color: isOngoing ? colors.success : colors.accent,
              fontWeight: 600,
            }}
          >
            {statusText}
          </span>
        )}
      </div>

      {totalTrips > 0 ? (
        <>
          {/* Stats row */}
          <div style={{
            display: 'flex', gap: isMobile ? 8 : 12, flexWrap: 'wrap',
            marginBottom: 14,
          }}>
            {[
              { value: totalTrips, unit: '次旅行', color: colors.primary },
              { value: destinations, unit: '目的地', color: colors.accent },
              { value: photoCount, unit: '张照片', color: colors.purple },
            ].map((s, i) => (
              <div key={i} style={{
                padding: '8px 14px', borderRadius: 12,
                background: colors.bg,
                flex: 1, minWidth: 80,
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                  {s.value}
                </div>
                <Text type="secondary" style={{ fontSize: 11 }}>{s.unit}</Text>
              </div>
            ))}
          </div>

          {/* Recent trip card */}
          {recentTrip && (
            <div style={{
              padding: '10px 14px', borderRadius: 14,
              background: gradients.primaryLight,
              border: `1px solid rgba(245,114,45,0.08)`,
              marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              {recentTrip.coverPhoto ? (
                <img src={recentTrip.coverPhoto} alt="" style={{
                  width: 44, height: 44, borderRadius: 10, objectFit: 'cover',
                  flexShrink: 0,
                }} />
              ) : (
                <div style={{
                  width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                  background: gradients.primary,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20,
                }}>
                  <span>🗺</span>
                </div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <Text type="secondary" style={{ fontSize: 10 }}>最近旅行</Text>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: colors.text,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {recentTrip.title}
                </div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {recentTrip.destination} · {recentTrip.startDate.slice(5).replace('-', '.')}
                </Text>
              </div>
            </div>
          )}

          {/* Year heatmap */}
          <div onClick={e => e.stopPropagation()}>
            <TravelYearMap trips={trips} />
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>🌍</div>
          <Text type="secondary" style={{ fontSize: 13 }}>还没有旅行记录，点击开始</Text>
        </div>
      )}
    </SectionCard>
  )
}

function AccountingSummaryCard({ onNavigate, isMobile }: { onNavigate: () => void; isMobile: boolean }) {
  const db = useDb()
  const today = dayjs()
  const yearMonth = today.format('YYYY-MM')
  const monthStart = `${yearMonth}-01`
  const lastDay = new Date(today.year(), today.month() + 1, 0).getDate()
  const monthEnd = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

  const transactions = useLiveQuery(
    () => db.accTransactions.where('date').between(monthStart, monthEnd + '\uffff').toArray(),
    [db, monthStart, monthEnd],
  ) ?? []

  const categories = useLiveQuery(() => db.accCategories.toArray(), [db]) ?? []

  const budgets = useLiveQuery(
    () => db.accBudgets.where('yearMonth').equals(yearMonth).toArray(),
    [db, yearMonth],
  ) ?? []

  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalBudget = budgets.find(b => b.categoryId === null)

  // Top 4 expense categories for mini donut
  const catMap = new Map(categories.map(c => [c.id, c]))
  const expByCat = new Map<number, number>()
  for (const t of transactions) {
    if (t.type === 'expense') {
      expByCat.set(t.categoryId, (expByCat.get(t.categoryId) ?? 0) + t.amount)
    }
  }
  const topCats = [...expByCat.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([catId, amount]) => {
      const cat = catMap.get(catId)
      return { color: cat?.color ?? '#6B7280', amount, emoji: cat?.emoji ?? '💰', name: cat?.name ?? '其他' }
    })

  const formatAmt = (n: number) => {
    if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
    return n % 1 === 0 ? String(n) : n.toFixed(2)
  }

  // Mini donut
  const MiniDonut = () => {
    const total = topCats.reduce((s, d) => s + d.amount, 0)
    if (topCats.length === 0 || total === 0) return null
    const size = 48
    const r = 16
    const cx = size / 2, cy = size / 2, sw = 8
    // Single category: render full circle instead of arc
    if (topCats.length === 1) {
      return (
        <svg width={size} height={size} style={{ display: 'block', flexShrink: 0 }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={topCats[0]!.color} strokeWidth={sw} />
        </svg>
      )
    }
    let startAngle = -90
    return (
      <svg width={size} height={size} style={{ display: 'block', flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={sw} />
        {topCats.map((d, i) => {
          const angle = Math.max((d.amount / total) * 360 - 1.5, 0.5)
          const s = (startAngle * Math.PI) / 180
          const e = ((startAngle + angle) * Math.PI) / 180
          const large = angle > 180 ? 1 : 0
          const path = `M ${cx + r * Math.cos(s)} ${cy + r * Math.sin(s)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(e)} ${cy + r * Math.sin(e)}`
          startAngle += (d.amount / total) * 360
          return <path key={i} d={path} fill="none" stroke={d.color} strokeWidth={sw} strokeLinecap="round" />
        })}
      </svg>
    )
  }

  if (transactions.length === 0) {
    return (
      <SectionCard onClick={onNavigate}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'linear-gradient(135deg, #DBEAFE, #BFDBFE)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AccountBookOutlined style={{ color: colors.accent, fontSize: 15 }} />
          </div>
          <Text strong style={{ fontSize: 15 }}>记账</Text>
        </div>
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>💰</div>
          <Text type="secondary" style={{ fontSize: 13 }}>还没有记账记录，点击开始</Text>
        </div>
      </SectionCard>
    )
  }

  return (
    <SectionCard onClick={onNavigate}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'linear-gradient(135deg, #DBEAFE, #BFDBFE)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AccountBookOutlined style={{ color: colors.accent, fontSize: 15 }} />
          </div>
          <Text strong style={{ fontSize: 15 }}>记账</Text>
        </div>
        {totalBudget && (
          <span style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 10,
            background: totalExpense > totalBudget.amount ? colors.dangerBg : colors.successBg,
            color: totalExpense > totalBudget.amount ? colors.danger : colors.success,
            fontWeight: 600,
          }}>
            预算 {Math.round((totalExpense / totalBudget.amount) * 100)}%
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 14 : 20 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: colors.danger, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            {formatAmt(totalExpense)}
            <span style={{ fontSize: 12, fontWeight: 500, marginLeft: 2, color: colors.textSecondary }}>支出</span>
          </div>
          {totalIncome > 0 && (
            <div style={{ fontSize: 13, marginTop: 4, color: colors.success, fontWeight: 600 }}>
              +{formatAmt(totalIncome)} 收入
            </div>
          )}
        </div>

        <MiniDonut />

        {topCats.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11 }}>
            {topCats.slice(0, 3).map(c => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>{c.emoji}</span>
                <span style={{ color: colors.textSecondary }}>{formatAmt(c.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  )
}
