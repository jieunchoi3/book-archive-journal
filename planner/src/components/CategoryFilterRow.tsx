import { Plus } from 'lucide-react'
import type { MouseEvent } from 'react'
import type { ItemsActions } from '../hooks/useItems'
import type { Category } from '../types/item'
import { NO_CATEGORY_ID } from '../types/item'

interface CategoryFilterRowProps {
  categories: Category[]
  selected: string
  onSelect: (id: string) => void
  items: ItemsActions
}

export function CategoryFilterRow({
  categories,
  selected,
  onSelect,
  items,
}: CategoryFilterRowProps) {
  const handleAdd = () => {
    const name = window.prompt('Category name')
    if (!name?.trim()) return
    const id = items.addCategory(name.trim())
    onSelect(id)
  }

  const handleRename = (cat: Category, e: MouseEvent) => {
    e.stopPropagation()
    const name = window.prompt('Rename category', cat.name)
    if (!name?.trim() || name === cat.name) return
    items.updateCategory(cat.id, { name: name.trim() })
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <FilterPill
        label="All"
        selected={selected === 'all'}
        onClick={() => onSelect('all')}
      />
      {categories.map((cat) => (
        <FilterPill
          key={cat.id}
          label={cat.name}
          color={cat.color}
          selected={selected === cat.id}
          onClick={() => onSelect(cat.id)}
          onDoubleClick={(e) => handleRename(cat, e)}
        />
      ))}
      <FilterPill
        label="No Category"
        selected={selected === NO_CATEGORY_ID}
        onClick={() => onSelect(NO_CATEGORY_ID)}
      />
      <button
        type="button"
        onClick={handleAdd}
        className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-hairline px-3 py-1.5 text-[12px] text-muted hover:border-[#007AFF]/40 hover:text-[#007AFF]"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}

function FilterPill({
  label,
  selected,
  onClick,
  color,
  onDoubleClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
  color?: string
  onDoubleClick?: (e: MouseEvent) => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
        selected
          ? 'bg-[#1C1C1E] text-white'
          : 'bg-white text-[#48484A] ring-1 ring-hairline hover:bg-[#F2F2F7]'
      }`}
    >
      {color && (
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: selected ? 'rgba(255,255,255,0.8)' : color }}
        />
      )}
      {label}
    </button>
  )
}
