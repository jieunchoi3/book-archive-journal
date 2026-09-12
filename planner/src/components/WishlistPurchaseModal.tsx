import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type {
  ExpenseCategory,
  ExpensePurpose,
  ExpensePurposeKindLink,
  ExpenseSpendKind,
  MoneyFlow,
  WishlistCategory,
  WishlistItem,
} from '../types/expense'
import { formatMoney, isExpenseHierarchyDate } from '../types/expense'
import {
  buildWishlistNote,
  suggestExpenseKindForCategory,
  suggestExpensePurposeForKind,
  wishlistItemTitle,
} from '../lib/wishlistCategories'
import { getTodayKey } from '../lib/weekUtils'

interface WishlistPurchaseModalProps {
  item: WishlistItem
  wishlistCategories: WishlistCategory[]
  expenseCategories: ExpenseCategory[]
  purposes: ExpensePurpose[]
  spendKinds: ExpenseSpendKind[]
  purposeKindLinks: ExpensePurposeKindLink[]
  kindsForActivePurpose: (purposeId: string) => ExpenseSpendKind[]
  onConfirm: (input: {
    amount: number
    flow: MoneyFlow
    categoryId?: string
    purposeId?: string
    spendKindId?: string
    dateKey: string
    note?: string
  }) => void
  onClose: () => void
}

export function WishlistPurchaseModal({
  item,
  wishlistCategories,
  expenseCategories,
  purposes,
  spendKinds,
  purposeKindLinks,
  kindsForActivePurpose,
  onConfirm,
  onClose,
}: WishlistPurchaseModalProps) {
  const dateKey = getTodayKey()
  const useDualAxis = isExpenseHierarchyDate(dateKey)

  const suggestedKindId = useMemo(
    () => suggestExpenseKindForCategory(wishlistCategories, item.categoryId, spendKinds),
    [wishlistCategories, item.categoryId, spendKinds],
  )
  const suggestedPurposeId = useMemo(
    () =>
      suggestedKindId
        ? suggestExpensePurposeForKind(suggestedKindId, purposeKindLinks ?? [])
        : null,
    [suggestedKindId, purposeKindLinks],
  )

  const [amount, setAmount] = useState(
    item.estimatedPrice != null ? String(item.estimatedPrice) : '',
  )
  const [note, setNote] = useState(buildWishlistNote(item))
  const [flow] = useState<MoneyFlow>('out')
  const [categoryId, setCategoryId] = useState(expenseCategories[0]?.id ?? '')
  const [purposeId, setPurposeId] = useState(
    suggestedPurposeId ?? purposes[0]?.id ?? '',
  )
  const [spendKindId, setSpendKindId] = useState(suggestedKindId ?? '')

  const purposeKinds = useMemo(
    () => (purposeId ? kindsForActivePurpose(purposeId) : []),
    [kindsForActivePurpose, purposeId],
  )

  useEffect(() => {
    if (spendKindId && !purposeKinds.some((k) => k.id === spendKindId)) {
      setSpendKindId(purposeKinds[0]?.id ?? '')
    }
  }, [purposeKinds, spendKindId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const canSubmit = useDualAxis
    ? Boolean(purposeId && spendKindId && Number(amount.replace(/,/g, '')) > 0)
    : Boolean(categoryId && Number(amount.replace(/,/g, '')) > 0)

  const submit = () => {
    const value = Number(amount.replace(/,/g, ''))
    if (!(value > 0)) return
    if (useDualAxis) {
      onConfirm({
        amount: value,
        flow,
        purposeId,
        spendKindId,
        dateKey,
        note,
      })
    } else {
      onConfirm({
        amount: value,
        flow,
        categoryId,
        dateKey,
        note,
      })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-4 sm:items-center">
      <div
        className="w-full max-w-md rounded-2xl border border-hairline bg-white p-5 shadow-xl"
        role="dialog"
        aria-labelledby="wishlist-purchase-title"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="wishlist-purchase-title" className="text-[17px] font-semibold text-[#1C1C1E]">
              Log purchase
            </h2>
            <p className="mt-0.5 text-[13px] text-muted">{wishlistItemTitle(item)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-[#F2F2F7]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
              Amount
            </span>
            <input
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2.5 text-[16px] font-semibold tabular-nums"
            />
          </label>

          {useDualAxis ? (
            <>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
                  Purpose
                </span>
                <select
                  value={purposeId}
                  onChange={(e) => setPurposeId(e.target.value)}
                  className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[13px]"
                >
                  {purposes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
                  Spend type
                </span>
                <select
                  value={spendKindId}
                  onChange={(e) => setSpendKindId(e.target.value)}
                  className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[13px]"
                >
                  {purposeKinds.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
                Category
              </span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[13px]"
              >
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
              Note
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[14px]"
            />
          </label>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            className="flex-1 rounded-xl bg-[#8B5A2B] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
          >
            Mark purchased & log {canSubmit ? formatMoney(Number(amount.replace(/,/g, ''))) : ''}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-hairline px-4 py-2.5 text-[13px] text-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
