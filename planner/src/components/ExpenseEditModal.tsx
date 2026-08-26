import { useEffect, useMemo, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import type {
  ExpenseCategory,
  ExpensePurpose,
  ExpenseSpendKind,
  MoneyFlow,
  MoneyTransaction,
} from '../types/expense'
import { isExpenseHierarchyDate } from '../types/expense'

interface ExpenseEditModalProps {
  transaction: MoneyTransaction
  expenseCategories: ExpenseCategory[]
  incomeCategories: ExpenseCategory[]
  purposes: ExpensePurpose[]
  kindsForActivePurpose: (purposeId: string) => ExpenseSpendKind[]
  onSave: (input: {
    amount: number
    flow: MoneyFlow
    categoryId?: string
    purposeId?: string
    spendKindId?: string
    dateKey: string
    note?: string
  }) => void
  onDelete: () => void
  onClose: () => void
}

export function ExpenseEditModal({
  transaction,
  expenseCategories,
  incomeCategories,
  purposes,
  kindsForActivePurpose,
  onSave,
  onDelete,
  onClose,
}: ExpenseEditModalProps) {
  const [flow, setFlow] = useState<MoneyFlow>(transaction.flow)
  const [amount, setAmount] = useState(String(transaction.amount))
  const [note, setNote] = useState(transaction.note)
  const [dateKey, setDateKey] = useState(transaction.dateKey)
  const [categoryId, setCategoryId] = useState(transaction.categoryId)
  const [purposeId, setPurposeId] = useState(transaction.purposeId ?? '')
  const [spendKindId, setSpendKindId] = useState(transaction.spendKindId ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setFlow(transaction.flow)
    setAmount(String(transaction.amount))
    setNote(transaction.note)
    setDateKey(transaction.dateKey)
    setCategoryId(transaction.categoryId)
    setPurposeId(transaction.purposeId ?? '')
    setSpendKindId(transaction.spendKindId ?? '')
    setConfirmDelete(false)
  }, [transaction])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const useDualAxis = flow === 'out' && isExpenseHierarchyDate(dateKey)
  const categories = flow === 'out' ? expenseCategories : incomeCategories
  const purposeKinds = useMemo(
    () => (purposeId ? kindsForActivePurpose(purposeId) : []),
    [kindsForActivePurpose, purposeId],
  )

  const activeCategoryId = useMemo(() => {
    if (categoryId && categories.some((c) => c.id === categoryId)) return categoryId
    return categories[0]?.id ?? ''
  }, [categories, categoryId])

  const activePurposeId = useMemo(() => {
    if (purposeId && purposes.some((p) => p.id === purposeId)) return purposeId
    return purposes[0]?.id ?? ''
  }, [purposes, purposeId])

  const activeSpendKindId = useMemo(() => {
    if (spendKindId && purposeKinds.some((k) => k.id === spendKindId))
      return spendKindId
    return purposeKinds[0]?.id ?? ''
  }, [purposeKinds, spendKindId])

  useEffect(() => {
    if (!useDualAxis) return
    if (spendKindId && !purposeKinds.some((k) => k.id === spendKindId)) {
      setSpendKindId(purposeKinds[0]?.id ?? '')
    }
  }, [useDualAxis, spendKindId, purposeKinds])

  const canSave = useDualAxis
    ? Boolean(activePurposeId && activeSpendKindId)
    : Boolean(activeCategoryId)

  const save = () => {
    const value = Number(amount.replace(/,/g, ''))
    if (!(value > 0) || !canSave) return
    if (useDualAxis) {
      onSave({
        amount: value,
        flow,
        purposeId: activePurposeId,
        spendKindId: activeSpendKindId,
        dateKey,
        note,
      })
    } else {
      onSave({
        amount: value,
        flow,
        categoryId: activeCategoryId,
        dateKey,
        note,
      })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-edit-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2
              id="expense-edit-title"
              className="text-[17px] font-semibold text-[#1C1C1E]"
            >
              Edit log
            </h2>
            <p className="text-[12px] text-muted">
              Change note, amount, category, or delete
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-[#F2F2F7]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setFlow('out')
              setCategoryId('')
            }}
            className={`rounded-xl py-2 text-[13px] font-semibold ${
              flow === 'out'
                ? 'bg-[#8B5A2B] text-white'
                : 'bg-[#F3E5D8] text-[#5C4033]'
            }`}
          >
            Out
          </button>
          <button
            type="button"
            onClick={() => {
              setFlow('in')
              setCategoryId('')
              setPurposeId('')
              setSpendKindId('')
            }}
            className={`rounded-xl py-2 text-[13px] font-semibold ${
              flow === 'in'
                ? 'bg-[#3D7A5A] text-white'
                : 'bg-[#E8F0E8] text-[#2F5D45]'
            }`}
          >
            In
          </button>
        </div>

        <label className="mb-3 block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
            Date
          </span>
          <input
            type="date"
            value={dateKey}
            onChange={(e) => setDateKey(e.target.value)}
            className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3.5 py-2.5 text-[14px] outline-none focus:border-[#8B5A2B]/50 focus:bg-white"
          />
        </label>

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
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              className="w-full rounded-xl border border-hairline bg-[#FAFAFA] py-3 pl-9 pr-3.5 text-[22px] font-semibold tabular-nums outline-none focus:border-[#8B5A2B]/50 focus:bg-white focus:ring-2 focus:ring-[#8B5A2B]/15"
            />
          </div>
        </label>

        <label className="mb-3 block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
            Note
          </span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Name or what it was for"
            className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3.5 py-2.5 text-[14px] outline-none focus:border-[#8B5A2B]/50 focus:bg-white"
          />
        </label>

        {useDualAxis ? (
          <>
            <div className="mb-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Purpose
              </p>
              <div className="flex flex-wrap gap-1.5">
                {purposes.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPurposeId(p.id)}
                    className={`rounded-full px-2.5 py-1.5 text-[12px] font-medium ${
                      activePurposeId === p.id
                        ? 'text-white'
                        : 'bg-[#F2F2F7] text-[#48484A]'
                    }`}
                    style={
                      activePurposeId === p.id
                        ? { backgroundColor: p.color }
                        : undefined
                    }
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Type
              </p>
              <div className="flex flex-wrap gap-1.5">
                {purposeKinds.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setSpendKindId(k.id)}
                    className={`rounded-full px-2.5 py-1.5 text-[12px] font-medium ${
                      activeSpendKindId === k.id
                        ? 'text-white'
                        : 'bg-[#F2F2F7] text-[#48484A]'
                    }`}
                    style={
                      activeSpendKindId === k.id
                        ? { backgroundColor: k.color }
                        : undefined
                    }
                  >
                    {k.name}
                  </button>
                ))}
                {purposeKinds.length === 0 && (
                  <p className="text-[12px] text-muted">No types under this purpose.</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="mb-4">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {flow === 'in' ? 'Source' : 'Category'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={`rounded-full px-2.5 py-1.5 text-[12px] font-medium ${
                    activeCategoryId === c.id
                      ? 'text-white'
                      : 'bg-[#F2F2F7] text-[#48484A]'
                  }`}
                  style={
                    activeCategoryId === c.id
                      ? { backgroundColor: c.color }
                      : undefined
                  }
                >
                  {c.name}
                </button>
              ))}
              {categories.length === 0 && (
                <p className="text-[12px] text-muted">No categories yet.</p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="flex-1 rounded-xl bg-[#8B5A2B] px-4 py-2.5 text-[14px] font-semibold text-white disabled:opacity-40"
          >
            Save
          </button>
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-hairline px-3 py-2.5 text-[13px] font-medium text-[#FF3B30] hover:bg-[#FFF5F5]"
            >
              <Trash2 size={15} />
              Delete
            </button>
          ) : (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-xl bg-[#FF3B30] px-3 py-2.5 text-[13px] font-semibold text-white"
            >
              Confirm delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
