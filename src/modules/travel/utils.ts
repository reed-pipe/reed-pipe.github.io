import type { Trip, TripSpot } from '@/shared/db'

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
