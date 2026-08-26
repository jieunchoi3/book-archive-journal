import type {
  ExpenseCategory,
  ExpensePurpose,
  ExpenseSpendKind,
  MoneyTransaction,
} from '../types/expense'
import { isDualAxisTransaction } from '../types/expense'

function csvEscape(value: string | number): string {
  const s = String(value ?? '')
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function buildExpenseCsv(
  transactions: MoneyTransaction[],
  opts: {
    categories: ExpenseCategory[]
    purposes?: ExpensePurpose[]
    spendKinds?: ExpenseSpendKind[]
  },
): string {
  const catById = new Map(opts.categories.map((c) => [c.id, c]))
  const purposeById = new Map((opts.purposes ?? []).map((p) => [p.id, p]))
  const kindById = new Map((opts.spendKinds ?? []).map((k) => [k.id, k]))

  const header = [
    'date',
    'flow',
    'amount',
    'category',
    'purpose',
    'spend_type',
    'note',
    'created_at',
  ]

  const rows = [...transactions]
    .sort((a, b) => {
      const d = a.dateKey.localeCompare(b.dateKey)
      if (d !== 0) return d
      return a.createdAt.localeCompare(b.createdAt)
    })
    .map((t) => {
      const dual = isDualAxisTransaction(t)
      const cat = catById.get(t.categoryId)
      const purpose = dual ? purposeById.get(t.purposeId ?? '') : undefined
      const kind = dual ? kindById.get(t.spendKindId ?? '') : undefined
      return [
        t.dateKey,
        t.flow,
        t.amount.toFixed(2),
        dual ? '' : (cat?.name ?? ''),
        purpose?.name ?? '',
        kind?.name ?? '',
        t.note ?? '',
        t.createdAt,
      ]
        .map(csvEscape)
        .join(',')
    })

  return [header.join(','), ...rows].join('\n')
}

export function downloadExpenseCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function exportExpenseCsvFile(
  transactions: MoneyTransaction[],
  opts: {
    categories: ExpenseCategory[]
    purposes?: ExpensePurpose[]
    spendKinds?: ExpenseSpendKind[]
    filename: string
  },
) {
  const { filename, ...rest } = opts
  const csv = buildExpenseCsv(transactions, rest)
  downloadExpenseCsv(csv, filename)
}
