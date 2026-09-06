import { useMemo, useState } from 'react'
import {
  ExternalLink,
  Heart,
  Pencil,
  ShoppingBag,
  Trash2,
  XCircle,
} from 'lucide-react'
import type { ExpenseActions } from '../hooks/useExpenses'
import type { WishlistItem } from '../types/expense'
import { formatMoney } from '../types/expense'
import {
  categoryPathLabel,
  itemMatchesFilter,
  type WishlistFilter,
  wishlistPriorityLabel,
} from '../lib/wishlistCategories'
import { WishlistItemForm } from './WishlistItemForm'
import { WishlistPurchaseModal } from './WishlistPurchaseModal'
import { WishlistSidebar } from './WishlistSidebar'

interface WishlistPanelProps {
  expenses: ExpenseActions
  onPurchased?: (transactionId: string) => void
}

const PRIORITY_STYLES = {
  high: 'bg-[#FF3B30]/10 text-[#FF3B30]',
  medium: 'bg-[#FF9500]/10 text-[#FF9500]',
  low: 'bg-[#8E8E93]/10 text-[#8E8E93]',
} as const

export function WishlistPanel({ expenses, onPurchased }: WishlistPanelProps) {
  const {
    wishlistCategories,
    wishlistItems,
    wishlistTree,
    addWishlistItem,
    updateWishlistItem,
    deleteWishlistItem,
    addWishlistCategory,
    renameWishlistCategory,
    deleteWishlistCategory,
    markWishlistPurchased,
    expenseCategories,
    purposes,
    spendKinds,
    purposeKindLinks,
    kindsForActivePurpose,
  } = expenses

  const [filter, setFilter] = useState<WishlistFilter>({ type: 'all' })
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null)
  const [purchaseItem, setPurchaseItem] = useState<WishlistItem | null>(null)

  const purchasedCount = useMemo(
    () => wishlistItems.filter((i) => i.status === 'purchased').length,
    [wishlistItems],
  )

  const visibleItems = useMemo(() => {
    return wishlistItems
      .filter((item) => itemMatchesFilter(item, filter, wishlistCategories))
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 }
        const p = priorityOrder[a.priority] - priorityOrder[b.priority]
        if (p !== 0) return p
        return b.createdAt.localeCompare(a.createdAt)
      })
  }, [wishlistItems, filter, wishlistCategories])

  const filterLabel = useMemo(() => {
    if (filter.type === 'all') return 'All items'
    if (filter.type === 'purchased') return 'Purchased'
    return categoryPathLabel(wishlistCategories, filter.categoryId)
  }, [filter, wishlistCategories])

  const handleAdd = (values: {
    name: string
    brand: string
    categoryId: string
    estimatedPrice: string
    priority: WishlistItem['priority']
    link: string
    note: string
  }) => {
    const price = values.estimatedPrice.trim()
      ? Number(values.estimatedPrice.replace(/,/g, ''))
      : null
    addWishlistItem({
      name: values.name,
      brand: values.brand,
      categoryId: values.categoryId,
      estimatedPrice: price != null && price > 0 ? price : null,
      priority: values.priority,
      link: values.link,
      note: values.note,
    })
  }

  const handleUpdate = (values: {
    name: string
    brand: string
    categoryId: string
    estimatedPrice: string
    priority: WishlistItem['priority']
    link: string
    note: string
  }) => {
    if (!editingItem) return
    const price = values.estimatedPrice.trim()
      ? Number(values.estimatedPrice.replace(/,/g, ''))
      : null
    updateWishlistItem(editingItem.id, {
      name: values.name,
      brand: values.brand,
      categoryId: values.categoryId,
      estimatedPrice: price != null && price > 0 ? price : null,
      priority: values.priority,
      link: values.link,
      note: values.note,
    })
    setEditingItem(null)
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <WishlistSidebar
        tree={wishlistTree}
        categories={wishlistCategories}
        filter={filter}
        purchasedCount={purchasedCount}
        onFilterChange={setFilter}
        onAddCategory={addWishlistCategory}
        onRenameCategory={renameWishlistCategory}
        onDeleteCategory={deleteWishlistCategory}
      />

      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-semibold text-[#1C1C1E]">{filterLabel}</h2>
            <p className="text-[12px] text-muted">
              {visibleItems.length} item{visibleItems.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
          {filter.type !== 'purchased' && (
            <WishlistItemForm
              categories={wishlistCategories}
              initial={
                editingItem
                  ? editingItem
                  : filter.type === 'category'
                    ? { categoryId: filter.categoryId }
                    : undefined
              }
              submitLabel={editingItem ? 'Save changes' : 'Add item'}
              onSubmit={editingItem ? handleUpdate : handleAdd}
              onCancel={editingItem ? () => setEditingItem(null) : undefined}
            />
          )}

          <div className="space-y-2">
            {visibleItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-hairline bg-white/60 px-6 py-12 text-center">
                <Heart size={28} className="mb-2 text-[#C4A484]" />
                <p className="text-[14px] font-medium text-[#1C1C1E]">Nothing here yet</p>
                <p className="mt-1 max-w-xs text-[12px] text-muted">
                  Save things you want to buy — organized by category like 화장품 or 옷 · 자켓.
                </p>
              </div>
            ) : (
              visibleItems.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-hairline bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[15px] font-semibold text-[#1C1C1E]">
                          {item.name}
                        </h3>
                        {item.status === 'want' && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_STYLES[item.priority]}`}
                          >
                            {wishlistPriorityLabel(item.priority)}
                          </span>
                        )}
                        {item.status === 'purchased' && (
                          <span className="rounded-full bg-[#3D7A5A]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#3D7A5A]">
                            Purchased
                          </span>
                        )}
                        {item.status === 'dropped' && (
                          <span className="rounded-full bg-[#8E8E93]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#8E8E93]">
                            Dropped
                          </span>
                        )}
                      </div>
                      {item.brand && (
                        <p className="mt-0.5 text-[13px] text-muted">{item.brand}</p>
                      )}
                      <p className="mt-1 text-[11px] text-[#8B5A2B]">
                        {categoryPathLabel(wishlistCategories, item.categoryId)}
                      </p>
                      {item.estimatedPrice != null && item.estimatedPrice > 0 && (
                        <p className="mt-1 text-[14px] font-semibold tabular-nums text-[#8B5A2B]">
                          {formatMoney(item.estimatedPrice)}
                        </p>
                      )}
                      {item.note && (
                        <p className="mt-2 text-[12px] leading-relaxed text-[#3C3C43]">
                          {item.note}
                        </p>
                      )}
                      {item.link && (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[#007AFF] hover:underline"
                        >
                          Open link
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col gap-1">
                      {item.status === 'want' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setPurchaseItem(item)}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#8B5A2B]/10 px-2.5 py-1.5 text-[11px] font-medium text-[#8B5A2B] hover:bg-[#8B5A2B]/15"
                          >
                            <ShoppingBag size={13} />
                            Bought
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingItem(item)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] text-muted hover:bg-[#F2F2F7]"
                          >
                            <Pencil size={13} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => updateWishlistItem(item.id, { status: 'dropped' })}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] text-muted hover:bg-[#F2F2F7]"
                          >
                            <XCircle size={13} />
                            Drop
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Delete this wishlist item?')) {
                            deleteWishlistItem(item.id)
                            if (editingItem?.id === item.id) setEditingItem(null)
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] text-[#FF3B30] hover:bg-[#FF3B30]/5"
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>

      {purchaseItem && (
        <WishlistPurchaseModal
          item={purchaseItem}
          wishlistCategories={wishlistCategories}
          expenseCategories={expenseCategories}
          purposes={purposes}
          spendKinds={spendKinds}
          purposeKindLinks={purposeKindLinks ?? []}
          kindsForActivePurpose={kindsForActivePurpose}
          onClose={() => setPurchaseItem(null)}
          onConfirm={(input) => {
            const txnId = markWishlistPurchased(purchaseItem.id, input)
            setPurchaseItem(null)
            if (txnId) onPurchased?.(txnId)
          }}
        />
      )}
    </div>
  )
}
