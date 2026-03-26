import type { AppDb, AccCategory, AccTransaction, TransactionType } from '@/shared/db'

// --- Preset categories ---

export interface PresetCategory {
  type: TransactionType
  name: string
  emoji: string
  color: string
}

export const EXPENSE_CATEGORIES: PresetCategory[] = [
  { type: 'expense', name: '餐饮', emoji: '🍜', color: '#F5722D' },
  { type: 'expense', name: '交通', emoji: '🚌', color: '#2563EB' },
  { type: 'expense', name: '购物', emoji: '🛒', color: '#EC4899' },
  { type: 'expense', name: '住房', emoji: '🏠', color: '#8B5CF6' },
  { type: 'expense', name: '通讯', emoji: '📱', color: '#06B6D4' },
  { type: 'expense', name: '水电', emoji: '💡', color: '#EAB308' },
  { type: 'expense', name: '娱乐', emoji: '🎬', color: '#F43F5E' },
  { type: 'expense', name: '医疗', emoji: '🏥', color: '#10B981' },
  { type: 'expense', name: '教育', emoji: '📚', color: '#3B82F6' },
  { type: 'expense', name: '服饰', emoji: '👔', color: '#A855F7' },
  { type: 'expense', name: '日用', emoji: '🧴', color: '#14B8A6' },
  { type: 'expense', name: '人情', emoji: '🎁', color: '#F97316' },
  { type: 'expense', name: '宠物', emoji: '🐱', color: '#84CC16' },
  { type: 'expense', name: '运动', emoji: '🏋️', color: '#059669' },
  { type: 'expense', name: '饮品', emoji: '☕', color: '#92400E' },
  { type: 'expense', name: '零食', emoji: '🍰', color: '#DB2777' },
  { type: 'expense', name: '其他', emoji: '💰', color: '#6B7280' },
]

export const INCOME_CATEGORIES: PresetCategory[] = [
  { type: 'income', name: '工资', emoji: '💼', color: '#059669' },
  { type: 'income', name: '奖金', emoji: '📈', color: '#D97706' },
  { type: 'income', name: '理财', emoji: '💹', color: '#2563EB' },
  { type: 'income', name: '兼职', emoji: '🏪', color: '#8B5CF6' },
  { type: 'income', name: '红包', emoji: '🎁', color: '#DC2626' },
  { type: 'income', name: '退款', emoji: '💸', color: '#06B6D4' },
  { type: 'income', name: '其他', emoji: '💰', color: '#6B7280' },
]

export const ALL_PRESET_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]

// --- Seed functions ---

export async function seedDefaultCategories(db: AppDb) {
  const count = await db.accCategories.count()
  if (count > 0) return
  try {
    const now = Date.now()
    const items = ALL_PRESET_CATEGORIES.map((c, i) => ({
      type: c.type,
      name: c.name,
      emoji: c.emoji,
      color: c.color,
      isCustom: false,
      sortOrder: i,
      createdAt: now + i,
      updatedAt: now + i,
    }))
    await db.accCategories.bulkAdd(items)
  } catch {
    // Ignore duplicate key errors from concurrent calls
  }
}

export async function seedDefaultLedger(db: AppDb) {
  const count = await db.ledgers.count()
  if (count > 0) return
  try {
    await db.ledgers.add({
      name: '日常账本',
      emoji: '📒',
      color: '#F5722D',
      isDefault: true,
      sortOrder: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  } catch {
    // Ignore duplicate key errors from concurrent calls
  }
}

// --- Format helpers ---

export function formatAmount(amount: number): string {
  if (amount >= 10000) {
    const w = amount / 10000
    return w % 1 === 0 ? `${w}万` : `${w.toFixed(2)}万`
  }
  return amount % 1 === 0 ? amount.toString() : amount.toFixed(2)
}

export function formatAmountWithSign(amount: number, type: TransactionType): string {
  const prefix = type === 'expense' ? '-' : '+'
  return `${prefix}${formatAmount(amount)}`
}

// --- Calculator expression parser (recursive descent, no eval) ---

export function parseCalcExpression(expr: string): number | null {
  const tokens = tokenize(expr)
  if (tokens.length === 0) return null
  try {
    const { value, pos } = parseExpr(tokens, 0)
    if (pos !== tokens.length) return null
    if (!isFinite(value) || isNaN(value)) return null
    return Math.round(value * 100) / 100
  } catch {
    return null
  }
}

type Token = { type: 'num'; value: number } | { type: 'op'; value: string }

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const s = expr.replace(/\s/g, '')
  while (i < s.length) {
    if ('+-×÷*/'.includes(s[i]!)) {
      let op = s[i]!
      if (op === '×') op = '*'
      if (op === '÷') op = '/'
      tokens.push({ type: 'op', value: op })
      i++
    } else if (/[\d.]/.test(s[i]!)) {
      let num = ''
      while (i < s.length && /[\d.]/.test(s[i]!)) {
        num += s[i]
        i++
      }
      const v = parseFloat(num)
      if (isNaN(v)) throw new Error('Invalid number')
      tokens.push({ type: 'num', value: v })
    } else {
      i++
    }
  }
  return tokens
}

function parseExpr(tokens: Token[], pos: number): { value: number; pos: number } {
  let { value, pos: p } = parseTerm(tokens, pos)
  while (p < tokens.length && tokens[p]!.type === 'op' && (tokens[p]!.value === '+' || tokens[p]!.value === '-')) {
    const op = tokens[p]!.value
    p++
    const right = parseTerm(tokens, p)
    p = right.pos
    value = op === '+' ? value + right.value : value - right.value
  }
  return { value, pos: p }
}

function parseTerm(tokens: Token[], pos: number): { value: number; pos: number } {
  let { value, pos: p } = parsePrimary(tokens, pos)
  while (p < tokens.length && tokens[p]!.type === 'op' && (tokens[p]!.value === '*' || tokens[p]!.value === '/')) {
    const op = tokens[p]!.value
    p++
    const right = parsePrimary(tokens, p)
    p = right.pos
    value = op === '*' ? value * right.value : value / right.value
  }
  return { value, pos: p }
}

function parsePrimary(tokens: Token[], pos: number): { value: number; pos: number } {
  const t = tokens[pos]
  if (!t) throw new Error('Unexpected end')
  if (t.type === 'num') return { value: t.value, pos: pos + 1 }
  // Handle unary minus
  if (t.type === 'op' && t.value === '-') {
    const { value, pos: p } = parsePrimary(tokens, pos + 1)
    return { value: -value, pos: p }
  }
  throw new Error('Unexpected token')
}

// --- Group transactions by date ---

export interface DateGroup {
  date: string
  transactions: AccTransaction[]
  totalExpense: number
  totalIncome: number
}

export function groupTransactionsByDate(transactions: AccTransaction[]): DateGroup[] {
  const map = new Map<string, AccTransaction[]>()
  for (const t of transactions) {
    const arr = map.get(t.date)
    if (arr) arr.push(t)
    else map.set(t.date, [t])
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, txns]) => ({
      date,
      transactions: txns.sort((a, b) => b.createdAt - a.createdAt),
      totalExpense: txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      totalIncome: txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    }))
}

// --- CSV export ---

export function exportAccountingCSV(
  transactions: AccTransaction[],
  categories: AccCategory[],
): string {
  const catMap = new Map(categories.map(c => [c.id, c]))
  const header = '日期,类型,分类,金额,备注,标签'
  const rows = [...transactions]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .map(t => {
      const cat = catMap.get(t.categoryId)
      return [
        t.date,
        t.type === 'expense' ? '支出' : '收入',
        cat ? `${cat.emoji}${cat.name}` : '未知',
        t.amount,
        (t.note || '').replace(/,/g, '，'),
        (t.tags || []).join('|'),
      ].join(',')
    })
  return [header, ...rows].join('\n')
}

// --- Date helpers ---

export function getMonthRange(yearMonth: string): { start: string; end: string } {
  const [y, m] = yearMonth.split('-').map(Number) as [number, number]
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

export function getWeekDay(dateStr: string): string {
  const days = ['日', '一', '二', '三', '四', '五', '六']
  const d = new Date(dateStr + 'T00:00:00')
  return '周' + days[d.getDay()]
}

export function formatDateLabel(dateStr: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  if (diff === 2) return '前天'
  return `${dateStr.slice(5).replace('-', '月')}日`
}
