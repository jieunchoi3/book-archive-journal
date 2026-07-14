import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { ItemsActions } from '../hooks/useItems'
import { CATEGORY_PALETTE, nextCategoryColor, type Category } from '../types/item'

function paletteWithCustom(colors: readonly string[], custom?: string): string[] {
  if (!custom || colors.includes(custom)) return [...colors]
  return [custom, ...colors]
}

function CategoryColorGrid({
  selectedColor,
  onSelect,
  customColor,
  compact,
}: {
  selectedColor: string
  onSelect: (color: string) => void
  customColor?: string
  compact?: boolean
}) {
  const colors = paletteWithCustom([...CATEGORY_PALETTE], customColor)

  return (
    <div
      className={`flex flex-wrap gap-1 ${compact ? 'max-h-[72px] overflow-y-auto pr-0.5' : ''}`}
    >
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onSelect(color)}
          className={`rounded-full ring-offset-1 ${
            compact ? 'h-4 w-4' : 'h-5 w-5'
          } ${selectedColor === color ? 'ring-2 ring-[#007AFF]' : 'ring-1 ring-black/10'}`}
          style={{ backgroundColor: color }}
          aria-label={`Color ${color}`}
        />
      ))}
    </div>
  )
}

interface EventCategoryPickerProps {
  categories: Category[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  items: ItemsActions
  compact?: boolean
  allowManage?: boolean
}

export function EventCategoryPicker({
  categories,
  selectedId,
  onSelect,
  items,
  compact = false,
  allowManage = false,
}: EventCategoryPickerProps) {
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string>(() => nextCategoryColor(categories))
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState(false)

  const selectedCategory = selectedId
    ? categories.find((c) => c.id === selectedId) ?? null
    : null

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    const id = items.addCategory(name, newColor)
    onSelect(id)
    setNewName('')
    setNewColor(nextCategoryColor(categories))
    setShowNew(false)
  }

  const pillClass = (selected: boolean) =>
    `flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 transition-colors ${
      compact ? 'text-[10px]' : 'text-[11px]'
    } ${
      selected
        ? 'border-[#007AFF] bg-[#007AFF]/10 font-medium text-[#007AFF]'
        : 'border-transparent bg-[#F2F2F7] text-[#48484A] hover:bg-[#E5E5EA]'
    }`

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      <label className={`block font-medium text-muted ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
        Category
      </label>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={pillClass(selectedId === null)}
        >
          None
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className={pillClass(selectedId === cat.id)}
          >
            <span
              className={`rounded-full ${compact ? 'h-1.5 w-1.5' : 'h-2 w-2'}`}
              style={{ backgroundColor: cat.color }}
            />
            {cat.name}
          </button>
        ))}
        {!showNew && (
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className={`flex shrink-0 items-center gap-0.5 rounded-full border border-dashed border-hairline text-muted hover:border-[#007AFF]/40 hover:text-[#007AFF] ${
              compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
            }`}
          >
            <Plus size={compact ? 10 : 12} />
            New
          </button>
        )}
      </div>

      {showNew && (
        <div className={`rounded-lg border border-hairline bg-[#FAFAFA] ${compact ? 'p-1.5' : 'p-2'}`}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Category name"
            autoFocus
            className={`mb-1.5 w-full rounded-md border border-hairline bg-white px-2 focus:outline-none focus:ring-1 focus:ring-[#007AFF]/30 ${
              compact ? 'py-1 text-[10px]' : 'py-1.5 text-[11px]'
            }`}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') setShowNew(false)
            }}
          />
          <CategoryColorGrid
            selectedColor={newColor}
            onSelect={setNewColor}
            compact={compact}
          />
          <div className="flex gap-1">
            <button
              type="button"
              disabled={!newName.trim()}
              onClick={handleCreate}
              className={`rounded-md bg-[#007AFF] font-medium text-white disabled:opacity-40 ${
                compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
              }`}
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className={`text-muted ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'}`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {allowManage && selectedCategory && (
        <div className="space-y-2 rounded-lg border border-hairline bg-[#FAFAFA] p-2">
          <p className="text-[10px] font-medium text-muted">
            Color for &ldquo;{selectedCategory.name}&rdquo;
          </p>
          <CategoryColorGrid
            selectedColor={selectedCategory.color}
            onSelect={(color) => items.updateCategory(selectedCategory.id, { color })}
            customColor={selectedCategory.color}
            compact={compact}
          />
          {confirmDeleteCategory ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  items.deleteCategory(selectedCategory.id)
                  onSelect(null)
                  setConfirmDeleteCategory(false)
                }}
                className="rounded-md bg-red-500 px-2 py-0.5 text-[10px] text-white"
              >
                Delete category
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteCategory(false)}
                className="text-[10px] text-muted"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDeleteCategory(true)}
              className="text-[10px] text-red-500 hover:underline"
            >
              Delete category &ldquo;{selectedCategory.name}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  )
}
