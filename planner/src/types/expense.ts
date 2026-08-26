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

/** Purpose axis for Sep+ logging (Social / For me / Others). */
export interface ExpensePurpose {
  id: string
  name: string
  color: string
  budget: number | null
}

/** Shared spend-type axis (외식, 카페, …) — same kind can link to multiple purposes. */
export interface ExpenseSpendKind {
  id: string
  name: string
  color: string
  /** Monthly budget across all purposes that use this kind. */
  budget: number | null
}

/** Which spend kinds appear under a purpose in the picker. */
export interface ExpensePurposeKindLink {
  purposeId: string
  spendKindId: string
}

export interface MoneyTransaction {
  id: string
  amount: number
  flow: MoneyFlow
  /** Legacy flat category (pre-Sep out, and all income). */
  categoryId: string
  /** Sep+ out: purpose axis. Empty on legacy / income. */
  purposeId?: string
  /** Sep+ out: spend-kind axis. Empty on legacy / income. */
  spendKindId?: string
  dateKey: string
  note: string
  createdAt: string
}

/** Explicit day status when there is no transaction to log. */
export type ExpenseDayMarkKind = 'no_spend'

export interface ExpenseStore {
  categories: ExpenseCategory[]
  transactions: MoneyTransaction[]
  /** dateKey → mark; cleared when a transaction is later added for that day. */
  dayMarks?: Record<string, ExpenseDayMarkKind>
  /** Sep+ purpose catalog (seeded once). */
  purposes?: ExpensePurpose[]
  /** Sep+ shared spend-kind catalog. */
  spendKinds?: ExpenseSpendKind[]
  /** Picker links: purpose ↔ spend kinds. */
  purposeKindLinks?: ExpensePurposeKindLink[]
}

/** Dual-axis logging / filters start on this date (inclusive). */
export const EXPENSE_HIERARCHY_START = '2026-09-01'

export function isExpenseHierarchyDate(dateKey: string): boolean {
  return Boolean(dateKey) && dateKey >= EXPENSE_HIERARCHY_START
}

/** monthKey is YYYY-MM */
export function isExpenseHierarchyMonth(monthKey: string): boolean {
  return Boolean(monthKey) && monthKey >= EXPENSE_HIERARCHY_START.slice(0, 7)
}

export function isDualAxisTransaction(t: MoneyTransaction): boolean {
  return Boolean(t.purposeId && t.spendKindId && t.flow === 'out')
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

/** Stable seed ids so links stay consistent across devices. */
export const SEED_PURPOSE_IDS = {
  social: 'purpose-social',
  forMe: 'purpose-forme',
  others: 'purpose-others',
} as const

export const SEED_KIND_IDS = {
  gifts: 'kind-gifts',
  dining: 'kind-dining',
  cafe: 'kind-cafe',
  culture: 'kind-culture',
  snack: 'kind-snack',
  beauty: 'kind-beauty',
  clothes: 'kind-clothes',
  misc: 'kind-misc',
  hobby: 'kind-hobby',
  tickets: 'kind-tickets',
  bills: 'kind-bills',
  subscriptions: 'kind-subscriptions',
} as const

export const DEFAULT_EXPENSE_PURPOSES: ExpensePurpose[] = [
  { id: SEED_PURPOSE_IDS.social, name: 'Social / for others', color: '#8B5A2B', budget: null },
  { id: SEED_PURPOSE_IDS.forMe, name: 'For me', color: '#D2691E', budget: null },
  { id: SEED_PURPOSE_IDS.others, name: 'Others', color: '#6B4226', budget: null },
]

export const DEFAULT_EXPENSE_SPEND_KINDS: ExpenseSpendKind[] = [
  { id: SEED_KIND_IDS.gifts, name: 'gifts', color: '#BC8F8F', budget: null },
  { id: SEED_KIND_IDS.dining, name: '외식', color: '#C4A484', budget: null },
  { id: SEED_KIND_IDS.cafe, name: '카페', color: '#DEB887', budget: null },
  { id: SEED_KIND_IDS.culture, name: '문화생활', color: '#A67B5B', budget: null },
  { id: SEED_KIND_IDS.snack, name: '간식', color: '#E8B923', budget: null },
  { id: SEED_KIND_IDS.beauty, name: '화장품', color: '#CD853F', budget: null },
  { id: SEED_KIND_IDS.clothes, name: '옷', color: '#A0522D', budget: null },
  { id: SEED_KIND_IDS.misc, name: '기타 소비', color: '#5C4033', budget: null },
  { id: SEED_KIND_IDS.hobby, name: '취미 활동', color: '#B87333', budget: null },
  { id: SEED_KIND_IDS.bills, name: 'bills', color: '#6B4226', budget: null },
  { id: SEED_KIND_IDS.subscriptions, name: 'subscriptions', color: '#3D7A5A', budget: null },
]

/** Shared 외식 / 카페 ids appear under both Social and For me. */
export const DEFAULT_PURPOSE_KIND_LINKS: ExpensePurposeKindLink[] = [
  { purposeId: SEED_PURPOSE_IDS.social, spendKindId: SEED_KIND_IDS.gifts },
  { purposeId: SEED_PURPOSE_IDS.social, spendKindId: SEED_KIND_IDS.dining },
  { purposeId: SEED_PURPOSE_IDS.social, spendKindId: SEED_KIND_IDS.cafe },
  { purposeId: SEED_PURPOSE_IDS.social, spendKindId: SEED_KIND_IDS.culture },
  { purposeId: SEED_PURPOSE_IDS.forMe, spendKindId: SEED_KIND_IDS.snack },
  { purposeId: SEED_PURPOSE_IDS.forMe, spendKindId: SEED_KIND_IDS.dining },
  { purposeId: SEED_PURPOSE_IDS.forMe, spendKindId: SEED_KIND_IDS.cafe },
  { purposeId: SEED_PURPOSE_IDS.forMe, spendKindId: SEED_KIND_IDS.beauty },
  { purposeId: SEED_PURPOSE_IDS.forMe, spendKindId: SEED_KIND_IDS.clothes },
  { purposeId: SEED_PURPOSE_IDS.forMe, spendKindId: SEED_KIND_IDS.misc },
  { purposeId: SEED_PURPOSE_IDS.forMe, spendKindId: SEED_KIND_IDS.hobby },
  { purposeId: SEED_PURPOSE_IDS.forMe, spendKindId: SEED_KIND_IDS.culture },
  { purposeId: SEED_PURPOSE_IDS.others, spendKindId: SEED_KIND_IDS.bills },
  { purposeId: SEED_PURPOSE_IDS.others, spendKindId: SEED_KIND_IDS.subscriptions },
]

export function emptyExpenseStore(): ExpenseStore {
  return {
    categories: [],
    transactions: [],
    dayMarks: {},
    purposes: [],
    spendKinds: [],
    purposeKindLinks: [],
  }
}

export function kindsForPurpose(
  purposeId: string,
  spendKinds: ExpenseSpendKind[],
  links: ExpensePurposeKindLink[],
): ExpenseSpendKind[] {
  const ids = new Set(
    links.filter((l) => l.purposeId === purposeId).map((l) => l.spendKindId),
  )
  return spendKinds.filter((k) => ids.has(k.id))
}

/** Spend kinds linked to at least one purpose (what Quick log can pick). */
export function linkedSpendKinds(
  spendKinds: ExpenseSpendKind[],
  links: ExpensePurposeKindLink[],
): ExpenseSpendKind[] {
  const ids = new Set(links.map((l) => l.spendKindId))
  return spendKinds.filter((k) => ids.has(k.id))
}

/**
 * Kinds for Report / month-log filters: still linked, or still referenced by
 * transactions (so old logs remain filterable after a catalog delete).
 */
export function catalogSpendKindsForFilters(
  spendKinds: ExpenseSpendKind[],
  links: ExpensePurposeKindLink[],
  transactions: MoneyTransaction[],
): ExpenseSpendKind[] {
  const linked = new Set(links.map((l) => l.spendKindId))
  const used = new Set(
    transactions
      .map((t) => t.spendKindId)
      .filter((id): id is string => Boolean(id)),
  )
  return spendKinds.filter((k) => linked.has(k.id) || used.has(k.id))
}

/** Sum of linked spend-kind budgets for a purpose (null if none set). */
export function sumKindBudgetsForPurpose(
  purposeId: string,
  spendKinds: ExpenseSpendKind[],
  links: ExpensePurposeKindLink[],
): number | null {
  const kinds = kindsForPurpose(purposeId, spendKinds, links)
  let sum = 0
  let any = false
  for (const k of kinds) {
    if (k.budget != null && k.budget > 0) {
      sum += k.budget
      any = true
    }
  }
  return any ? sum : null
}

export function dualAxisLabel(
  purpose: ExpensePurpose | undefined,
  kind: ExpenseSpendKind | undefined,
): string {
  if (purpose && kind) return `${purpose.name} · ${kind.name}`
  if (kind) return kind.name
  if (purpose) return purpose.name
  return 'Unknown'
}

/** Ensure Sep+ catalogs exist; never rewrite transactions. */
export function ensureDualAxisCatalogs(store: ExpenseStore): ExpenseStore {
  const hasPurposes = Array.isArray(store.purposes) && store.purposes.length > 0
  if (!hasPurposes) {
    return {
      ...store,
      purposes: DEFAULT_EXPENSE_PURPOSES.map((p) => ({ ...p })),
      spendKinds: DEFAULT_EXPENSE_SPEND_KINDS.map((k) => ({ ...k })),
      purposeKindLinks: DEFAULT_PURPOSE_KIND_LINKS.map((l) => ({ ...l })),
    }
  }

  let links = [...(store.purposeKindLinks ?? [])]
  const forMe = SEED_PURPOSE_IDS.forMe
  const tickets = SEED_KIND_IDS.tickets
  const culture = SEED_KIND_IDS.culture
  const hadTickets = links.some((l) => l.purposeId === forMe && l.spendKindId === tickets)
  const hasCulture = links.some((l) => l.purposeId === forMe && l.spendKindId === culture)
  if (hadTickets || !hasCulture) {
    links = links.filter((l) => !(l.purposeId === forMe && l.spendKindId === tickets))
    if (!links.some((l) => l.purposeId === forMe && l.spendKindId === culture)) {
      links.push({ purposeId: forMe, spendKindId: culture })
    }
  }
  // Drop leftover 입장료 links anywhere — culture replaced it.
  links = links.filter((l) => l.spendKindId !== tickets)

  const linkedIds = new Set(links.map((l) => l.spendKindId))
  const usedIds = new Set(
    (store.transactions ?? [])
      .map((t) => t.spendKindId)
      .filter((id): id is string => Boolean(id)),
  )

  const spendKinds = (() => {
    let kinds = (store.spendKinds ?? []).map((k) => ({
      ...k,
      budget: k.budget ?? null,
    }))
    if (!kinds.some((k) => k.id === culture)) {
      const seed = DEFAULT_EXPENSE_SPEND_KINDS.find((k) => k.id === culture)
      if (seed) kinds.push({ ...seed })
    }
    // Drop catalog orphans (e.g. seeded 입장료 with no purpose link and no logs).
    kinds = kinds.filter(
      (k) =>
        k.id === culture ||
        linkedIds.has(k.id) ||
        usedIds.has(k.id),
    )
    return kinds
  })()

  const purposes = (store.purposes ?? []).map((p) => ({
    ...p,
    budget: sumKindBudgetsForPurpose(p.id, spendKinds, links),
  }))

  return {
    ...store,
    purposes,
    spendKinds,
    purposeKindLinks: links,
  }
}

export function normalizeExpenseTransactions(
  transactions: MoneyTransaction[],
): MoneyTransaction[] {
  return transactions.map((t) => ({
    ...t,
    categoryId: t.categoryId ?? '',
    purposeId: t.purposeId ?? '',
    spendKindId: t.spendKindId ?? '',
  }))
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
