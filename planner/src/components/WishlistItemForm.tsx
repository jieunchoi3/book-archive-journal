import { useEffect, useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { WishlistCategory, WishlistItem, WishlistPriority } from '../types/expense'
import {
  categoryPath,
  categoryPathLabel,
  childrenOf,
  defaultWishlistCategoryId,
} from '../lib/wishlistCategories'

export type WishlistItemFormValues = {
  name: string
  brand: string
  categoryId: string
  estimatedPrice: string
  priority: WishlistPriority
  link: string
  note: string
}

interface WishlistItemFormProps {
  categories: WishlistCategory[]
  initial?: Partial<WishlistItem>
  submitLabel?: string
  onSubmit: (values: WishlistItemFormValues) => void
  onCancel?: () => void
}

export function WishlistItemForm({
  categories,
  initial,
  submitLabel = 'Add item',
  onSubmit,
  onCancel,
}: WishlistItemFormProps) {
  const defaultCategoryId = initial?.categoryId ?? defaultWishlistCategoryId(categories)
  const [name, setName] = useState(initial?.name ?? '')
  const [brand, setBrand] = useState(initial?.brand ?? '')
  const [categoryId, setCategoryId] = useState(defaultCategoryId)
  const [estimatedPrice, setEstimatedPrice] = useState(
    initial?.estimatedPrice != null ? String(initial.estimatedPrice) : '',
  )
  const [priority, setPriority] = useState<WishlistPriority>(initial?.priority ?? 'medium')
  const [link, setLink] = useState(initial?.link ?? '')
  const [note, setNote] = useState(initial?.note ?? '')

  useEffect(() => {
    setName(initial?.name ?? '')
    setBrand(initial?.brand ?? '')
    setCategoryId(initial?.categoryId ?? defaultWishlistCategoryId(categories))
    setEstimatedPrice(initial?.estimatedPrice != null ? String(initial.estimatedPrice) : '')
    setPriority(initial?.priority ?? 'medium')
    setLink(initial?.link ?? '')
    setNote(initial?.note ?? '')
  }, [initial, categories])

  const path = useMemo(() => categoryPath(categories, categoryId), [categories, categoryId])
  const rootId = path[0]?.id ?? categoryId
  const level2Id = path[1]?.id ?? ''
  const level3Id = path[2]?.id ?? ''

  const rootOptions = childrenOf(categories, null)
  const level2Options = rootId ? childrenOf(categories, rootId) : []
  const level3Options = level2Id ? childrenOf(categories, level2Id) : []

  const setFromLevels = (root: string, mid: string, leaf: string) => {
    if (leaf && categories.some((c) => c.id === leaf)) {
      setCategoryId(leaf)
      return
    }
    if (mid && categories.some((c) => c.id === mid)) {
      setCategoryId(mid)
      return
    }
    if (root && categories.some((c) => c.id === root)) {
      setCategoryId(root)
    }
  }

  const canSubmit = name.trim().length > 0 && Boolean(categoryId)

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit({
      name,
      brand,
      categoryId,
      estimatedPrice,
      priority,
      link,
      note,
    })
  }

  return (
    <div className="rounded-2xl border border-hairline bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-[13px] font-semibold text-[#1C1C1E]">
        {initial?.id ? 'Edit wishlist item' : 'Add to wishlist'}
      </h3>

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
            Item name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Air Max 90"
            className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[14px]"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
            Brand
          </span>
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Nike"
            className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[14px]"
          />
        </label>

        <div>
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
            Category
          </span>
          <div className="space-y-2">
            <select
              value={rootId}
              onChange={(e) => setFromLevels(e.target.value, '', '')}
              className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[13px]"
            >
              {rootOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {level2Options.length > 0 && (
              <select
                value={level2Id || rootId}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === rootId) setFromLevels(rootId, '', '')
                  else setFromLevels(rootId, val, '')
                }}
                className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[13px]"
              >
                <option value={rootId}>All {path[0]?.name}</option>
                {level2Options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            {level3Options.length > 0 && (
              <select
                value={level3Id || level2Id || rootId}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === level2Id) setFromLevels(rootId, level2Id, '')
                  else setFromLevels(rootId, level2Id, val)
                }}
                className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[13px]"
              >
                <option value={level2Id}>All {path[1]?.name ?? path[0]?.name}</option>
                {level3Options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="mt-1 text-[11px] text-muted">{categoryPathLabel(categories, categoryId)}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
              Est. price
            </span>
            <input
              value={estimatedPrice}
              onChange={(e) => setEstimatedPrice(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[14px] tabular-nums"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
              Priority
            </span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as WishlistPriority)}
              className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[13px]"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
            Link
          </span>
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[14px]"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
            Note
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[14px]"
          />
        </label>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#8B5A2B] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
        >
          <Check size={16} />
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-xl border border-hairline px-3 py-2.5 text-[13px] text-muted"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
