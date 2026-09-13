import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { restoreWishlistFromBackup } from '../lib/wishlistBackup'
import { createPortal } from 'react-dom'
import {
  ExternalLink,
  Heart,
  MoreHorizontal,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import type { ExpenseActions } from '../hooks/useExpenses'
import type { WishlistCategory, WishlistItem, WishlistPriority } from '../types/expense'
import { formatMoney } from '../types/expense'
import {
  buildWishlistBrandOptions,
  buildWishlistStoreOptions,
  categoryPathLabel,
  itemMatchesFilter,
  wishlistFilterLabel,
  wishlistItemImages,
  wishlistItemSubtitle,
  type WishlistFilter,
  wishlistPriorityLabel,
} from '../lib/wishlistCategories'
import { WishlistItemForm, type WishlistItemFormValues } from './WishlistItemForm'
import { WishlistPhotoCarousel } from './WishlistPhotoCarousel'
import { WishlistPurchaseModal } from './WishlistPurchaseModal'
import { WishlistSidebar } from './WishlistSidebar'

interface WishlistPanelProps {
  expenses: ExpenseActions
  onPurchased?: (transactionId: string) => void
}

type PriorityFilter = 'all' | WishlistPriority

const PRIORITY_STYLES = {
  high: 'bg-[#FF3B30]/10 text-[#FF3B30]',
  medium: 'bg-[#FF9500]/10 text-[#FF9500]',
  low: 'bg-[#8E8E93]/10 text-[#8E8E93]',
} as const

const PRIORITY_FILTERS: { id: PriorityFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'high', label: 'High priority' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
]

export function WishlistPanel({ expenses, onPurchased }: WishlistPanelProps) {
  const {
    loading,
    wishlistCategories,
    wishlistItems,
    wishlistTree,
    addWishlistItem,
    updateWishlistItem,
    deleteWishlistItem,
    addWishlistCategory,
    renameWishlistCategory,
    deleteWishlistCategory,
    restoreWishlistFromLocalBackup,
    markWishlistPurchased,
    expenseCategories,
    purposes,
    spendKinds,
    purposeKindLinks,
    kindsForActivePurpose,
  } = expenses
  const { user } = useAuth()

  const [filter, setFilter] = useState<WishlistFilter>({ type: 'all' })
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [purchaseItem, setPurchaseItem] = useState<WishlistItem | null>(null)
  const [addFormKey, setAddFormKey] = useState(0)
  const [menuItemId, setMenuItemId] = useState<string | null>(null)

  const purchasedCount = useMemo(
    () => wishlistItems.filter((i) => i.status === 'purchased').length,
    [wishlistItems],
  )

  const storeOptions = useMemo(
    () => buildWishlistStoreOptions(wishlistItems),
    [wishlistItems],
  )

  const brandOptions = useMemo(
    () => buildWishlistBrandOptions(wishlistItems),
    [wishlistItems],
  )

  const visibleItems = useMemo(() => {
    return wishlistItems
      .filter((item) => itemMatchesFilter(item, filter, wishlistCategories))
      .filter((item) => priorityFilter === 'all' || item.priority === priorityFilter)
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 }
        const p = priorityOrder[a.priority] - priorityOrder[b.priority]
        if (p !== 0) return p
        return b.createdAt.localeCompare(a.createdAt)
      })
  }, [wishlistItems, filter, wishlistCategories, priorityFilter])

  const filterLabel = useMemo(
    () => wishlistFilterLabel(filter, wishlistCategories, storeOptions, brandOptions),
    [filter, wishlistCategories, storeOptions, brandOptions],
  )

  const backupItemCount = useMemo(() => {
    return restoreWishlistFromBackup(user.id).length
  }, [user.id, wishlistItems.length])

  const autoRestoreAttempted = useRef(false)
  useEffect(() => {
    if (loading || autoRestoreAttempted.current) return
    if (wishlistItems.length > 0) return
    if (backupItemCount === 0) return
    autoRestoreAttempted.current = true
    const count = restoreWishlistFromLocalBackup()
    if (count > 0) {
      setRestoreMessage(
        `Restored ${count} item${count === 1 ? '' : 's'} from browser backup.`,
      )
    }
  }, [loading, wishlistItems.length, backupItemCount, restoreWishlistFromLocalBackup])

  const formInitial = useMemo(() => {
    if (editingItem) return editingItem
    if (filter.type === 'category') return { categoryId: filter.categoryId }
    if (filter.type === 'store') {
      const label = storeOptions.find((o) => o.key === filter.storeKey)?.label
      return label ? { store: label } : undefined
    }
    if (filter.type === 'brand') {
      const label = brandOptions.find((o) => o.key === filter.brandKey)?.label
      return label ? { brand: label } : undefined
    }
    return undefined
  }, [editingItem, filter, storeOptions, brandOptions])

  const showFormModal = showAddForm || editingItem != null

  const closeFormModal = () => {
    setShowAddForm(false)
    setEditingItem(null)
  }

  const handleAdd = (values: WishlistItemFormValues) => {
    const price = values.estimatedPrice.trim()
      ? Number(values.estimatedPrice.replace(/,/g, ''))
      : null
    addWishlistItem({
      name: values.name,
      brand: values.brand,
      shop: values.store,
      categoryId: values.categoryId,
      estimatedPrice: price != null && price > 0 ? price : null,
      priority: values.priority,
      link: values.link,
      note: values.note,
      size: values.size,
      imageDataUrls: values.imageDataUrls,
    })
    setAddFormKey((k) => k + 1)
    setShowAddForm(false)
  }

  const handleUpdate = (values: WishlistItemFormValues) => {
    if (!editingItem) return
    const price = values.estimatedPrice.trim()
      ? Number(values.estimatedPrice.replace(/,/g, ''))
      : null
    updateWishlistItem(editingItem.id, {
      name: values.name,
      brand: values.brand,
      store: values.store,
      categoryId: values.categoryId,
      estimatedPrice: price != null && price > 0 ? price : null,
      priority: values.priority,
      link: values.link,
      note: values.note,
      size: values.size,
      imageDataUrls: values.imageDataUrls,
    })
    setEditingItem(null)
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <WishlistSidebar
        tree={wishlistTree}
        categories={wishlistCategories}
        storeOptions={storeOptions}
        brandOptions={brandOptions}
        filter={filter}
        purchasedCount={purchasedCount}
        onFilterChange={setFilter}
        onAddCategory={addWishlistCategory}
        onRenameCategory={renameWishlistCategory}
        onDeleteCategory={deleteWishlistCategory}
      />

      <div className="@container min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-[#1C1C1E]">{filterLabel}</h2>
            <p className="text-[12px] text-muted">
              {visibleItems.length} item{visibleItems.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {filter.type !== 'purchased' && (
          <div className="flex flex-wrap gap-1.5">
            {PRIORITY_FILTERS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPriorityFilter(id)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                  priorityFilter === id
                    ? 'bg-[#8B5A2B]/12 text-[#8B5A2B]'
                    : 'bg-[#F2F2F7] text-muted hover:text-[#48484A]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {visibleItems.length === 0 && filter.type === 'purchased' ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-hairline bg-white/60 px-6 py-12 text-center">
            <Heart size={28} className="mb-2 text-[#C4A484]" />
            <p className="text-[14px] font-medium text-[#1C1C1E]">Nothing here yet</p>
            <p className="mt-1 max-w-xs text-[12px] text-muted">
              Items you mark as purchased will show up here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,clamp(6.75rem,22cqi,12.5rem)),1fr))] gap-[clamp(0.5rem,1.5cqi,0.875rem)] overflow-visible">
            {filter.type !== 'purchased' && (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="group flex w-full flex-col text-muted transition-colors hover:text-[#8B5A2B]"
                aria-label="Add wishlist item"
              >
                <span className="flex aspect-[4/5] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-hairline bg-white/80 transition-colors group-hover:border-[#8B5A2B]/35 group-hover:bg-[#FBF7F2]">
                  <span className="flex h-[clamp(2rem,5vw,3rem)] w-[clamp(2rem,5vw,3rem)] items-center justify-center rounded-full border border-hairline bg-[#FAFAFA] transition-colors group-hover:border-[#8B5A2B]/25 group-hover:bg-white">
                    <Plus size={22} strokeWidth={1.75} />
                  </span>
                </span>
                <span className="mt-1.5 text-center text-[11px] font-medium">Add item</span>
              </button>
            )}

            {visibleItems.map((item) => (
              <WishlistGridCard
                key={item.id}
                item={item}
                categories={wishlistCategories}
                menuOpen={menuItemId === item.id}
                onToggleMenu={() =>
                  setMenuItemId((id) => (id === item.id ? null : item.id))
                }
                onCloseMenu={() => setMenuItemId(null)}
                onEdit={() => {
                  setMenuItemId(null)
                  setEditingItem(item)
                }}
                onPurchase={() => {
                  setMenuItemId(null)
                  setPurchaseItem(item)
                }}
                onDrop={() => {
                  setMenuItemId(null)
                  updateWishlistItem(item.id, { status: 'dropped' })
                }}
                onDelete={() => {
                  setMenuItemId(null)
                  if (window.confirm('Delete this wishlist item?')) {
                    deleteWishlistItem(item.id)
                    if (editingItem?.id === item.id) setEditingItem(null)
                  }
                }}
              />
            ))}
          </div>
        )}

        {visibleItems.length === 0 && filter.type !== 'purchased' && (
          <div className="space-y-2 text-center">
            <p className="text-[12px] text-muted">
              No items match this filter yet — tap + to add one.
            </p>
            {filter.type === 'all' && backupItemCount > 0 && (
              <div className="space-y-2">
                <p className="text-[12px] text-[#8B5A2B]">
                  Found a local backup with up to {backupItemCount} item
                  {backupItemCount === 1 ? '' : 's'}.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const count = restoreWishlistFromLocalBackup()
                    setRestoreMessage(
                      count > 0
                        ? `Restored ${count} item${count === 1 ? '' : 's'} from browser backup.`
                        : 'No backup could be restored.',
                    )
                  }}
                  className="rounded-lg bg-[#8B5A2B] px-3 py-1.5 text-[12px] font-semibold text-white"
                >
                  Restore from browser backup
                </button>
              </div>
            )}
            {restoreMessage && (
              <p className="text-[12px] text-[#1C1C1E]">{restoreMessage}</p>
            )}
          </div>
        )}
      </div>

      {showFormModal && (
        <WishlistItemFormModal
          title={editingItem ? 'Edit item' : 'Add to wishlist'}
          onClose={closeFormModal}
        >
          <WishlistItemForm
            key={editingItem ? `edit-${editingItem.id}` : `add-${addFormKey}`}
            categories={wishlistCategories}
            initial={formInitial}
            submitLabel={editingItem ? 'Save changes' : 'Add item'}
            onSubmit={editingItem ? handleUpdate : handleAdd}
            onCancel={closeFormModal}
          />
        </WishlistItemFormModal>
      )}

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

function WishlistItemFormModal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-4 sm:items-center">
      <div
        className="flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-xl"
        role="dialog"
        aria-labelledby="wishlist-form-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-hairline px-5 py-4">
          <h2 id="wishlist-form-title" className="text-[17px] font-semibold text-[#1C1C1E]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-[#F2F2F7]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

function WishlistGridCard({
  item,
  categories,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onEdit,
  onPurchase,
  onDrop,
  onDelete,
}: {
  item: WishlistItem
  categories: WishlistCategory[]
  menuOpen: boolean
  onToggleMenu: () => void
  onCloseMenu: () => void
  onEdit: () => void
  onPurchase: () => void
  onDrop: () => void
  onDelete: () => void
}) {
  const subtitle = wishlistItemSubtitle(item)
  const categoryLabel = categoryPathLabel(categories, item.categoryId)
  const images = wishlistItemImages(item)
  const photoRef = useRef<HTMLDivElement>(null)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [hoverPreview, setHoverPreview] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  const showHoverPreview = useCallback(() => {
    if (images.length === 0) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const rect = photoRef.current?.getBoundingClientRect()
    if (!rect) return

    const width = Math.min(Math.max(rect.width * 2.35, 168), 320)
    const height = width * (5 / 4)
    const margin = 10
    let top = rect.top - height - margin
    if (top < margin) top = rect.bottom + margin
    const left = Math.min(
      Math.max(margin, rect.left + rect.width / 2 - width / 2),
      window.innerWidth - width - margin,
    )
    setHoverPreview({ top, left, width })
  }, [images.length])

  const hideHoverPreview = useCallback(() => {
    setHoverPreview(null)
  }, [])

  useEffect(() => {
    if (!hoverPreview) return
    const onScroll = () => hideHoverPreview()
    window.addEventListener('scroll', onScroll, true)
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [hoverPreview, hideHoverPreview])

  return (
    <article className="group relative z-0 flex w-full flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-sm transition-shadow hover:z-20 hover:shadow-md">
      <div
        ref={photoRef}
        className="relative aspect-[4/5] w-full bg-[#F5F5F7]"
        onMouseEnter={showHoverPreview}
        onMouseLeave={hideHoverPreview}
        onFocus={showHoverPreview}
        onBlur={hideHoverPreview}
      >
        <WishlistPhotoCarousel
          images={images}
          className="h-full w-full transition-transform duration-200 [@media(hover:hover)]:hover:scale-[1.03]"
          activeIndex={photoIndex}
          onActiveIndexChange={setPhotoIndex}
          onTap={onEdit}
          emptyLabel="No photo · tap to edit"
        />

        {hoverPreview &&
          images[photoIndex] &&
          createPortal(
            <div
              className="pointer-events-none fixed z-[100]"
              style={{
                top: hoverPreview.top,
                left: hoverPreview.left,
                width: hoverPreview.width,
              }}
            >
              <div className="overflow-hidden rounded-xl border border-white/90 bg-white shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
                <img
                  src={images[photoIndex]}
                  alt=""
                  className="aspect-[4/5] w-full object-cover"
                  draggable={false}
                />
              </div>
            </div>,
            document.body,
          )}

        {item.status === 'want' && (
          <span
            className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide backdrop-blur-sm ${PRIORITY_STYLES[item.priority]}`}
          >
            {wishlistPriorityLabel(item.priority)}
          </span>
        )}

        {item.status === 'purchased' && (
          <span className="absolute left-2 top-2 rounded-full bg-[#3D7A5A]/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
            Purchased
          </span>
        )}

        {item.status === 'dropped' && (
          <span className="absolute left-2 top-2 rounded-full bg-[#8E8E93]/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
            Dropped
          </span>
        )}

        <div className="absolute right-2 top-2 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleMenu()
            }}
            className="rounded-lg bg-white/90 p-1.5 text-[#48484A] shadow-sm backdrop-blur-sm hover:bg-white"
            aria-label="Item actions"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Close menu"
                onClick={onCloseMenu}
              />
              <div className="absolute right-0 z-20 mt-1 min-w-[120px] overflow-hidden rounded-xl border border-hairline bg-white py-1 shadow-md">
                {item.status === 'want' && (
                  <>
                    <MenuAction icon={ShoppingBag} label="Bought" onClick={onPurchase} />
                    <MenuAction icon={Pencil} label="Edit" onClick={onEdit} />
                    <MenuAction icon={XCircle} label="Drop" onClick={onDrop} />
                  </>
                )}
                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[#1C1C1E] hover:bg-[#FAFAFA]"
                    onClick={onCloseMenu}
                  >
                    <ExternalLink size={13} />
                    Open link
                  </a>
                )}
                <MenuAction icon={Trash2} label="Delete" onClick={onDelete} danger />
              </div>
            </>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 space-y-0.5 p-2.5 text-left transition-colors hover:bg-[#FAFAFA]"
      >
        <h3 className="line-clamp-2 text-[12px] font-semibold leading-snug text-[#1C1C1E]">
          {item.name}
        </h3>
        {subtitle && (
          <p className="truncate text-[10px] text-muted">{subtitle}</p>
        )}
        <p className="truncate text-[10px] text-[#8B5A2B]/80">{categoryLabel}</p>
        {item.estimatedPrice != null && item.estimatedPrice > 0 && (
          <p className="text-[12px] font-semibold tabular-nums text-[#8B5A2B]">
            {formatMoney(item.estimatedPrice)}
          </p>
        )}
      </button>
    </article>
  )
}

function MenuAction({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: typeof Pencil
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[#FAFAFA] ${
        danger ? 'text-[#FF3B30]' : 'text-[#1C1C1E]'
      }`}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}
