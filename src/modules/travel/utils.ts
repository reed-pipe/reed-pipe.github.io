import type { Trip, TripSpot, TransportType, CostCategory } from '@/shared/db'

// Travel module design tokens
export const T = {
  // Color palette
  primary: '#F5722D',
  primaryHover: '#FF8C4A',
  primaryBg: '#FFF7E6',
  primaryLight: '#FFD8BF',
  primaryDark: '#D4500A',
  text: '#8C4A1E',
  textLight: '#B87333',

  // Gradients
  gradient: 'linear-gradient(135deg, #F5722D, #FF9A5C)',
  gradientLight: 'linear-gradient(135deg, #FFF7E6, #FFE8D5)',
  gradientSubtle: 'linear-gradient(135deg, rgba(245,114,45,0.06), rgba(245,114,45,0.12))',

  // Route line color (contrasts with map tiles)
  route: '#2563EB',
  routeLight: 'rgba(37, 99, 235, 0.5)',

  // Shadows
  shadow: 'rgba(245, 114, 45, 0.25)',
  shadowLight: 'rgba(245, 114, 45, 0.12)',

  // Glassmorphism presets
  glass: {
    background: 'rgba(255,255,255,0.72)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.45)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
  } as React.CSSProperties,

  glassCard: {
    background: 'rgba(255,255,255,0.82)',
    backdropFilter: 'blur(12px) saturate(160%)',
    WebkitBackdropFilter: 'blur(12px) saturate(160%)',
    border: '1px solid rgba(255,255,255,0.5)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.8)',
    borderRadius: 16,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  } as React.CSSProperties,

  glassCardHover: {
    boxShadow: `0 8px 28px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(245,114,45,0.15), inset 0 1px 0 rgba(255,255,255,0.9)`,
    transform: 'translateY(-2px)',
  } as React.CSSProperties,

  glassButton: {
    background: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.5)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
    borderRadius: 12,
  } as React.CSSProperties,
}

/** 花费分类 */
export const COST_CATEGORIES: { value: CostCategory; label: string; emoji: string; color: string }[] = [
  { value: 'transport', label: '交通', emoji: '🚗', color: '#2563EB' },
  { value: 'food', label: '餐饮', emoji: '🍜', color: '#F5722D' },
  { value: 'hotel', label: '住宿', emoji: '🏨', color: '#8B5CF6' },
  { value: 'ticket', label: '门票', emoji: '🎫', color: '#059669' },
  { value: 'shopping', label: '购物', emoji: '🛍️', color: '#EC4899' },
  { value: 'other', label: '其他', emoji: '💰', color: '#6B7280' },
]

export function getCostCategoryLabel(cat?: CostCategory): string {
  return COST_CATEGORIES.find(c => c.value === cat)?.label ?? '其他'
}

export function getCostCategoryEmoji(cat?: CostCategory): string {
  return COST_CATEGORIES.find(c => c.value === cat)?.emoji ?? '💰'
}

/** 旅行状态 */
export type TripStatus = 'upcoming' | 'ongoing' | 'completed'

export function getTripStatus(trip: Trip): TripStatus {
  const today = new Date().toISOString().slice(0, 10)
  if (today < trip.startDate) return 'upcoming'
  if (today > trip.endDate) return 'completed'
  return 'ongoing'
}

export function getTripStatusLabel(trip: Trip): { text: string; color: string; bg: string } {
  const status = getTripStatus(trip)
  const today = new Date().toISOString().slice(0, 10)
  if (status === 'upcoming') {
    const days = Math.ceil((new Date(trip.startDate + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000)
    return { text: `${days}天后出发`, color: '#2563EB', bg: '#EFF6FF' }
  }
  if (status === 'ongoing') {
    const dayNum = Math.floor((new Date(today + 'T00:00:00').getTime() - new Date(trip.startDate + 'T00:00:00').getTime()) / 86_400_000) + 1
    return { text: `进行中 · Day ${dayNum}`, color: '#059669', bg: '#ECFDF5' }
  }
  return { text: '已完成', color: '#6B7280', bg: '#F3F4F6' }
}

/** 排序方式 */
export type TripSortKey = 'date' | 'created' | 'rating' | 'cost'

export function sortTrips(trips: Trip[], sortKey: TripSortKey): Trip[] {
  const sorted = [...trips]
  switch (sortKey) {
    case 'date': return sorted.sort((a, b) => b.startDate.localeCompare(a.startDate))
    case 'created': return sorted.sort((a, b) => b.createdAt - a.createdAt)
    case 'rating': return sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    case 'cost': return sorted.sort((a, b) => (b.totalCost ?? 0) - (a.totalCost ?? 0))
    default: return sorted
  }
}

/** 交通工具配置 */
export const TRANSPORT_OPTIONS: { value: TransportType; label: string; emoji: string }[] = [
  { value: 'plane', label: '飞机', emoji: '✈️' },
  { value: 'train', label: '高铁/火车', emoji: '🚄' },
  { value: 'car', label: '自驾', emoji: '🚗' },
  { value: 'bus', label: '大巴', emoji: '🚌' },
  { value: 'ship', label: '轮船', emoji: '🚢' },
  { value: 'bike', label: '骑行', emoji: '🚲' },
  { value: 'walk', label: '步行', emoji: '🚶' },
  { value: 'other', label: '其他', emoji: '📍' },
]

export function getTransportEmoji(type?: TransportType): string {
  return TRANSPORT_OPTIONS.find((t) => t.value === type)?.emoji ?? '📍'
}

export function getTransportLabel(type?: TransportType): string {
  return TRANSPORT_OPTIONS.find((t) => t.value === type)?.label ?? '其他'
}

/** 计算旅行天数 */
export function tripDays(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1)
}

/** 格式化日期范围 */
export function formatDateRange(start: string, end: string): string {
  const s = start.replace(/-/g, '.')
  const e = end.replace(/-/g, '.')
  return `${s} ~ ${e}`
}

/** 格式化花费 */
export function formatCost(cost: number | undefined): string {
  if (cost == null) return ''
  return `¥${cost.toLocaleString()}`
}

/** 按 date+sortOrder 排序打卡点 */
export function sortSpots(spots: TripSpot[]): TripSpot[] {
  return [...spots].sort((a, b) => a.date.localeCompare(b.date) || a.sortOrder - b.sortOrder)
}

/** 按日期分组打卡点 */
export function groupSpotsByDate(spots: TripSpot[]): Map<string, TripSpot[]> {
  const sorted = sortSpots(spots)
  const map = new Map<string, TripSpot[]>()
  for (const s of sorted) {
    const list = map.get(s.date) ?? []
    list.push(s)
    map.set(s.date, list)
  }
  return map
}

/** 统计所有旅行 */
export function computeStats(trips: Trip[], spots: TripSpot[]) {
  const totalTrips = trips.length
  const totalDays = trips.reduce((s, t) => s + tripDays(t.startDate, t.endDate), 0)
  const totalCost = trips.reduce((s, t) => s + (t.totalCost ?? 0), 0)
  const destinations = new Set(trips.map((t) => t.destination))
  const totalSpots = spots.length
  return { totalTrips, totalDays, totalCost, destinations: destinations.size, totalSpots }
}

/**
 * 弹出系统文件选择器（兼容 PWA standalone 模式）。
 * 动态创建 input 并同步调用 click()，确保在用户手势调用栈内触发，
 * 否则 Android WebView 会拒绝弹出文件选择器。
 */
export function pickImage(multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    if (multiple) input.multiple = true
    input.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;'
    document.body.appendChild(input)

    let resolved = false
    const done = (files: File[]) => {
      if (resolved) return
      resolved = true
      if (document.body.contains(input)) document.body.removeChild(input)
      resolve(files)
    }

    input.addEventListener('change', () => {
      done(Array.from(input.files ?? []))
    })

    // Fallback: if user cancels, resolve empty after focus returns
    window.addEventListener('focus', () => {
      setTimeout(() => { if (!resolved) done([]) }, 600)
    }, { once: true })

    // MUST be synchronous — no rAF/setTimeout, or PWA WebView rejects it
    input.click()
  })
}

/** 压缩图片到指定最大宽度和质量 */
export function compressImage(file: File, maxWidth = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width
        let h = img.height
        if (w > maxWidth) {
          h = (h * maxWidth) / w
          w = maxWidth
        }
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** 导出旅行数据为 CSV */
export function exportTravelCSV(trips: Trip[], spots: TripSpot[]): string {
  const header = '旅行,目的地,开始日期,结束日期,天数,标签,评分,总花费,感想'
  const rows = [...trips]
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .map((t) =>
      [
        t.title.replace(/,/g, '，'),
        t.destination,
        t.startDate,
        t.endDate,
        tripDays(t.startDate, t.endDate),
        t.tags.join('/'),
        t.rating ?? '',
        t.totalCost ?? '',
        (t.summary ?? '').replace(/,/g, '，').replace(/\n/g, ' '),
      ].join(','),
    )

  const spotHeader = '\n\n地点,所属旅行,日期,地址,花费,备注'
  const tripMap = new Map(trips.map((t) => [t.id, t.title]))
  const spotRows = [...spots]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) =>
      [
        s.name.replace(/,/g, '，'),
        (tripMap.get(s.tripId) ?? '').replace(/,/g, '，'),
        s.date,
        (s.address ?? '').replace(/,/g, '，'),
        s.cost ?? '',
        (s.note ?? '').replace(/,/g, '，').replace(/\n/g, ' '),
      ].join(','),
    )

  return [header, ...rows, spotHeader, ...spotRows].join('\n')
}
