import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { ItemsActions } from '../hooks/useItems'
import type { Category, Item } from '../types/item'
import { ItemCard } from './ItemCard'
import { QuickAddItemModal, EditItemModal } from './ItemModals'

interface TasksColumnProps {
  category: Category | null
  columnItems: Item[]
  stats: { done: number; total: number }
  items: ItemsActions
  allCategories: Category[]
}

export function TasksColumn({
  category,
  columnItems,
  stats,
  items,
  allCategories,
}: TasksColumnProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const categoryId = category?.id ?? null
  const color = category?.color ?? '#8E8E93'

  return (
    <div className="flex w-[220px] shrink-0 flex-col rounded-xl border border-hairline bg-[#FAFAFA]">
      <header className="border-b border-hairline px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <h3 className="truncate text-[13px] font-semibold text-[#1C1C1E]">
              {category?.name ?? 'No Category'}
            </h3>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-[11px] text-muted">
              {stats.done}/{stats.total}
            </span>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="rounded-md p-0.5 text-muted hover:bg-white hover:text-[#007AFF]"
              aria-label="Add item"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-2 p-2">
        {columnItems.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            onToggle={() => items.toggleItemDone(item.id, item.dueDate ?? undefined)}
            onClick={() => setEditingItem(item)}
          />
        ))}
        {columnItems.length === 0 && (
          <p className="px-1 py-4 text-center text-[11px] text-muted">No items</p>
        )}
      </div>

      {showAdd && (
        <QuickAddItemModal
          categoryId={categoryId}
          categories={allCategories}
          tags={items.tags}
          items={items}
          onClose={() => setShowAdd(false)}
        />
      )}

      {editingItem && (
        <EditItemModal
          item={editingItem}
          items={items}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  )
}
