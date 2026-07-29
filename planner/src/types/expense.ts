export type MoneyFlow = 'out' | 'in'

export interface ExpenseCategory {
  id: string
  name: string
  color: string
  /** Applies to expense categories; income sources ignore this. */
  kind: MoneyFlow
  /** Monthly budget in the same currency units as transactions (expenses only). */
  budget: number | null
}

export interface MoneyTransaction {
  id: string
  amount: number
  flow: MoneyFlow
  categoryId: string
  dateKey: string
  note: string
  createdAt: string
}

export interface ExpenseStore {
  categories: ExpenseCategory[]
  transactions: MoneyTransaction[]
}

export const EXPENSE_COLORS = [
  '#8B5A2B',
  '#C4A484',
  '#A0522D',
  '#D2691E',
  '#CD853F',
  '#DEB887',
  '#6B4226',
  '#B87333',
  '#E8B923',
  '#5C4033',
  '#BC8F8F',
  '#A67B5B',
] as const

export const DEFAULT_EXPENSE_CATEGORIES: Omit<ExpenseCategory, 'id'>[] = [
  { name: 'Food', color: '#C4A484', kind: 'out', budget: null },
  { name: 'Transport', color: '#8B5A2B', kind: 'out', budget: null },
  { name: 'Shopping', color: '#D2691E', kind: 'out', budget: null },
  { name: 'Bills', color: '#6B4226', kind: 'out', budget: null },
  { name: 'Fun', color: '#E8B923', kind: 'out', budget: null },
  { name: 'Other', color: '#A67B5B', kind: 'out', budget: null },
]

export const DEFAULT_INCOME_SOURCES: Omit<ExpenseCategory, 'id'>[] = [
  { name: 'Salary', color: '#5C8A4D', kind: 'in', budget: null },
  { name: 'Freelance', color: '#3D7A5A', kind: 'in', budget: null },
  { name: 'Gift', color: '#7A9E6A', kind: 'in', budget: null },
  { name: 'Other', color: '#8FBC8F', kind: 'in', budget: null },
]

export function emptyExpenseStore(): ExpenseStore {
  return { categories: [], transactions: [] }
}

export function formatMoney(amount: number, currency = '£'): string {
  const abs = Math.abs(amount)
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return `${currency}${formatted}`
}

/** Light → dark brown based on t in [0, 1]. */
export function spendHeatColor(t: number): string {
  const clamped = Math.min(1, Math.max(0, t))
  // #F3E5D8 → #4A2C1A
  const r1 = 0xf3,
    g1 = 0xe5,
    b1 = 0xd8
  const r2 = 0x4a,
    g2 = 0x2c,
    b2 = 0x1a
  const r = Math.round(r1 + (r2 - r1) * clamped)
  const g = Math.round(g1 + (g2 - g1) * clamped)
  const b = Math.round(b1 + (b2 - b1) * clamped)
  return `rgb(${r}, ${g}, ${b})`
}
