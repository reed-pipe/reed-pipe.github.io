import type { WeightRecord, BodyMeasurement } from '@/shared/db'

/**
 * 计算 BMI，返回保留一位小数的数值。
 * 身高单位 cm，体重单位 kg。
 */
export function calculateBMI(weight: number, heightCm: number): number {
  return +(weight / (heightCm / 100) ** 2).toFixed(1)
}

/** 根据当前时间自动判断时段 */
export function detectPeriod(): 'morning' | 'evening' {
  return new Date().getHours() < 14 ? 'morning' : 'evening'
}

/** 计算连续记录天数（从今天往回数） */
export function calculateStreak(records: WeightRecord[]): number {
  if (records.length === 0) return 0
  const dates = new Set(records.map((r) => r.date))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let streak = 0
  for (let d = new Date(today); ; d.setDate(d.getDate() - 1)) {
    const key = d.toISOString().slice(0, 10)
    if (dates.has(key)) {
      streak++
    } else {
      // 今天还没记录不算断，但前天断了就结束
      if (streak === 0 && d.getTime() === today.getTime()) continue
      break
    }
  }
  return streak
}

/** 基于近期趋势预测到达目标体重的天数，返回 null 表示无法预测 */
export function predictDaysToGoal(
  records: WeightRecord[],
  goalWeight: number | null,
): number | null {
  if (goalWeight === null || records.length < 4) return null
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  // 取最近 14 条记录做线性回归
  const recent = sorted.slice(-14)
  if (recent.length < 4) return null

  const startDate = new Date(recent[0]!.date + 'T00:00:00').getTime()
  const msPerDay = 86_400_000
  const xs = recent.map((r) => (new Date(r.date + 'T00:00:00').getTime() - startDate) / msPerDay)
  const ys = recent.map((r) => r.weight)

  const n = xs.length
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i]!, 0)
  const sumX2 = xs.reduce((a, x) => a + x * x, 0)

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  if (Math.abs(slope) < 0.001) return null // 趋势平坦

  const latestWeight = ys[ys.length - 1]!
  const daysToGoal = (goalWeight - latestWeight) / slope

  if (daysToGoal < 0) return null // 趋势方向不对
  return Math.round(daysToGoal)
}

/** 计算 N 点移动平均 */
export function movingAverage(
  values: { x: number; y: number }[],
  window: number,
): { x: number; y: number }[] {
  if (values.length < window) return []
  const result: { x: number; y: number }[] = []
  for (let i = window - 1; i < values.length; i++) {
    let sum = 0
    for (let j = i - window + 1; j <= i; j++) {
      sum += values[j]!.y
    }
    result.push({ x: values[i]!.x, y: sum / window })
  }
  return result
}

/** 导出体重记录为 CSV */
export function exportWeightCSV(records: WeightRecord[]): string {
  const periodMap: Record<string, string> = {
    morning: '早晨',
    evening: '晚上',
    other: '其他',
  }
  const header = '日期,时段,体重(kg),BMI,体脂率(%),备注'
  const rows = [...records]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) =>
      [
        r.date,
        periodMap[r.period] ?? r.period,
        r.weight,
        r.bmi ?? '',
        r.bodyFat ?? '',
        (r.note ?? '').replace(/,/g, '，'),
      ].join(','),
    )
  return [header, ...rows].join('\n')
}

/** 导出围度记录为 CSV */
export function exportMeasurementCSV(records: BodyMeasurement[]): string {
  const header = '日期,腰围(cm),臀围(cm),胸围(cm),左臂围(cm),右臂围(cm),左腿围(cm),右腿围(cm),备注'
  const rows = [...records]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) =>
      [
        r.date,
        r.waist ?? '',
        r.hip ?? '',
        r.chest ?? '',
        r.leftArm ?? '',
        r.rightArm ?? '',
        r.leftThigh ?? '',
        r.rightThigh ?? '',
        (r.note ?? '').replace(/,/g, '，'),
      ].join(','),
    )
  return [header, ...rows].join('\n')
}
