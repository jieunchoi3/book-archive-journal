import { Plus } from 'lucide-react'
import type { MouseEvent } from 'react'
import type { ItemsActions } from '../hooks/useItems'
import type { Tag } from '../types/item'

interface TagFilterRowProps {
  tags: Tag[]
  selected: string[]
  onToggle: (id: string) => void
  items: ItemsActions
}

export function TagFilterRow({ tags, selected, onToggle, items }: TagFilterRowProps) {
  const handleAdd = () => {
    const name = window.prompt('Tag name')
    if (!name?.trim()) return
    const icon = window.prompt('Tag icon (optional emoji)') ?? undefined
    const id = items.addTag(name.trim(), icon)
    onToggle(id)
  }

  const handleRename = (tag: Tag, e: MouseEvent) => {
    e.stopPropagation()
    const name = window.prompt('Rename tag', tag.name)
    if (!name?.trim() || name === tag.name) return
    items.updateTag(tag.id, { name: name.trim() })
  }

  if (tags.length === 0) {
    return (
      <div className="flex gap-2 pb-2">
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1 rounded-full border border-dashed border-hairline px-3 py-1 text-[11px] text-muted hover:text-[#007AFF]"
        >
          <Plus size={12} />
          Add tag
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-2">
      {tags.map((tag) => {
        const isSelected = selected.includes(tag.id)
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => onToggle(tag.id)}
            onDoubleClick={(e) => handleRename(tag, e)}
            className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              isSelected
                ? 'bg-[#5856D6] text-white'
                : 'bg-[#F2F2F7] text-[#636366] ring-1 ring-transparent hover:bg-[#E5E5EA]'
            }`}
          >
            {tag.icon && <span>{tag.icon}</span>}
            {tag.name}
          </button>
        )
      })}
      <button
        type="button"
        onClick={handleAdd}
        className="flex shrink-0 items-center rounded-full border border-dashed border-hairline p-1 text-muted hover:text-[#007AFF]"
      >
        <Plus size={12} />
      </button>
    </div>
  )
}
