import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { ExpenseCategory, MoneyFlow } from '../types/expense'
import { EXPENSE_COLORS, formatMoney } from '../types/expense'
import { getTodayKey } from '../lib/weekUtils'

interface ExpenseQuickAddProps {
  expenseCategories: ExpenseCategory[]
  incomeCategories: ExpenseCategory[]
  defaultDateKey?: string
  onAdd: (input: {
    amount: number
    flow: MoneyFlow
    categoryId: string
    dateKey: string
    note?: string
  }) => void
  onAddCategory: (input: { name: string; color: string; kind: MoneyFlow }) => string
  onRenameCategory: (categoryId: string, name: string) => void
  onDeleteCategory: (categoryId: string) => void
  /** Mark the selected date as no spending (past days only). */
  onMarkNoSpend?: (dateKey: string) => void
}

export function ExpenseQuickAdd({
  expenseCategories,
  incomeCategories,
  defaultDateKey,
  onAdd,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  onMarkNoSpend,
}: ExpenseQuickAddProps) {
  const [flow, setFlow] = useState<MoneyFlow>('out')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [dateKey, setDateKey] = useState(defaultDateKey ?? getTodayKey())
  const [note, setNote] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  useEffect(() => {
    if (defaultDateKey) setDateKey(defaultDateKey)
  }, [defaultDateKey])

  const categories = flow === 'out' ? expenseCategories : incomeCategories

  const activeCategoryId = useMemo(() => {
    if (categoryId && categories.some((c) => c.id === categoryId)) return categoryId
    return categories[0]?.id ?? ''
  }, [categories, categoryId])

  const activeCategory = categories.find((c) => c.id === activeCategoryId)

  const submit = () => {
    const value = Number(amount.replace(/,/g, ''))
    if (!(value > 0) || !activeCategoryId) return
    onAdd({
      amount: value,
      flow,
      categoryId: activeCategoryId,
      dateKey,
      note,
    })
    setAmount('')
    setNote('')
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1200)
  }

  const createCategory = () => {
    const name = newCatName.trim()
    if (!name) return
    const color = EXPENSE_COLORS[categories.length % EXPENSE_COLORS.length]
    const id = onAddCategory({ name, color, kind: flow })
    setCategoryId(id)
    setNewCatName('')
    setShowNewCat(false)
  }

  return (
    <div className="rounded-2xl border border-hairline bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-[#1C1C1E]">Quick log</h2>
          <p className="text-[12px] text-muted">Amount · category · day — in or out</p>
        </div>
        {savedFlash && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F8EC] px-2.5 py-1 text-[11px] font-medium text-[#1B7F3A]">
            <Check size={12} /> Saved
          </span>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setFlow('out')
            setCategoryId('')
          }}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-semibold transition-colors ${
            flow === 'out'
              ? 'bg-[#8B5A2B] text-white'
              : 'bg-[#F3E5D8] text-[#5C4033] hover:bg-[#EAD7C4]'
          }`}
        >
          <ArrowUpRight size={16} /> Out
        </button>
        <button
          type="button"
          onClick={() => {
            setFlow('in')
            setCategoryId('')
          }}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-semibold transition-colors ${
            flow === 'in'
              ? 'bg-[#3D7A5A] text-white'
              : 'bg-[#E8F0E8] text-[#2F5D45] hover:bg-[#D8E6D8]'
          }`}
        >
          <ArrowDownLeft size={16} /> In
        </button>
      </div>

      <label className="mb-3 block">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
          Amount
        </span>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] font-semibold text-muted">
            £
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0"
            className="w-full rounded-xl border border-hairline bg-[#FAFAFA] py-3 pl-9 pr-3.5 text-[22px] font-semibold tabular-nums text-[#1C1C1E] outline-none focus:border-[#8B5A2B]/50 focus:bg-white focus:ring-2 focus:ring-[#8B5A2B]/15"
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
          />
        </div>
      </label>

      <div className="mb-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            {flow === 'out' ? 'Category' : 'Source'}
          </span>
          <button
            type="button"
            onClick={() => setShowNewCat((v) => !v)}
            className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[#8B5A2B]"
          >
            <Plus size={12} /> New
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => {
            const selected = cat.id === activeCategoryId
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setCategoryId(cat.id)
                  setEditingId(null)
                }}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                  selected ? 'text-white shadow-sm' : 'bg-[#F5F5F7] text-[#48484A]'
                }`}
                style={selected ? { backgroundColor: cat.color } : undefined}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: selected ? 'rgba(255,255,255,0.85)' : cat.color }}
                />
                {cat.name}
              </button>
            )
          })}
        </div>
        {activeCategory && editingId === activeCategory.id ? (
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={editingName}
              autoFocus
              onChange={(e) => setEditingName(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-hairline bg-[#FAFAFA] px-3 py-2 text-[13px] outline-none focus:border-[#8B5A2B]/40"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onRenameCategory(activeCategory.id, editingName)
                  setEditingId(null)
                }
                if (e.key === 'Escape') setEditingId(null)
              }}
            />
            <button
              type="button"
              onClick={() => {
                onRenameCategory(activeCategory.id, editingName)
                setEditingId(null)
              }}
              className="rounded-lg bg-[#8B5A2B] px-3 py-2 text-[12px] font-semibold text-white"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="rounded-lg bg-[#F2F2F7] px-2.5 py-2 text-muted"
              aria-label="Cancel"
            >
              <X size={14} />
            </button>
          </div>
        ) : activeCategory ? (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingId(activeCategory.id)
                setEditingName(activeCategory.name)
                setShowNewCat(false)
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-[#F5F5F7] px-2.5 py-1.5 text-[11px] font-medium text-[#48484A] hover:bg-[#EBEBEF]"
            >
              <Pencil size={12} /> Rename
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `Delete “${activeCategory.name}”? Past logs keep amounts but lose this label.`,
                  )
                ) {
                  onDeleteCategory(activeCategory.id)
                  setCategoryId('')
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-[#F5F5F7] px-2.5 py-1.5 text-[11px] font-medium text-[#FF3B30] hover:bg-[#FFF1F0]"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        ) : null}
        {showNewCat && (
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder={flow === 'out' ? 'Category name' : 'Source name'}
              className="min-w-0 flex-1 rounded-lg border border-hairline bg-[#FAFAFA] px-3 py-2 text-[13px] outline-none focus:border-[#8B5A2B]/40"
              onKeyDown={(e) => {
                if (e.key === 'Enter') createCategory()
              }}
            />
            <button
              type="button"
              onClick={createCategory}
              className="rounded-lg bg-[#8B5A2B] px-3 py-2 text-[12px] font-semibold text-white"
            >
              Add
            </button>
          </div>
        )}
      </div>

      <label className="mb-3 block">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
          Date
        </span>
        <input
          type="date"
          value={dateKey}
          onChange={(e) => setDateKey(e.target.value)}
          className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3.5 py-2.5 text-[14px] text-[#1C1C1E] outline-none focus:border-[#8B5A2B]/50 focus:bg-white"
        />
      </label>

      <label className="mb-4 block">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
          Note <span className="font-normal normal-case text-muted/80">(optional)</span>
        </span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What was this for?"
          className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3.5 py-2.5 text-[14px] text-[#1C1C1E] outline-none focus:border-[#8B5A2B]/50 focus:bg-white"
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
        />
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={!amount || Number(amount) <= 0 || !activeCategoryId}
        className="w-full rounded-xl bg-[#1C1C1E] py-3 text-[14px] font-semibold text-white disabled:opacity-40"
      >
        Log {flow === 'out' ? 'expense' : 'income'}
        {amount && Number(amount) > 0 ? ` · ${formatMoney(Number(amount))}` : ''}
      </button>

      {onMarkNoSpend && dateKey < getTodayKey() && (
        <button
          type="button"
          onClick={() => {
            onMarkNoSpend(dateKey)
            setSavedFlash(true)
            window.setTimeout(() => setSavedFlash(false), 1200)
          }}
          className="mt-2 w-full rounded-xl border border-dashed border-[#8B5A2B]/35 bg-[#FBF6F0] py-2.5 text-[13px] font-medium text-[#8B5A2B] hover:bg-[#F5EBE0]"
        >
          이 날은 지출 없음
        </button>
      )}
    </div>
  )
}
