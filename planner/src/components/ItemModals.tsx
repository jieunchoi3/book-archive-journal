import { useState } from 'react'
import { X } from 'lucide-react'
import type { ItemsActions } from '../hooks/useItems'
import type { Category, Item, Recurrence, Tag } from '../types/item'
import { EventCategoryPicker } from './EventCategoryPicker'
import { RecurrenceFields } from './RecurrenceFields'

interface QuickAddItemModalProps {
  categoryId: string | null
  categories: Category[]
  tags: Tag[]
  items: ItemsActions
  onClose: () => void
}

export function QuickAddItemModal({
  categoryId,
  categories,
  tags,
  items,
  onClose,
}: QuickAddItemModalProps) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryId)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null)
  const [showOnWeeklyView, setShowOnWeeklyView] = useState(!!dueDate)

  const toggleTag = (id: string) => {
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
  }

  const handleAdd = () => {
    if (!title.trim()) return
    items.addItem({
      title: title.trim(),
      categoryId: selectedCategory,
      tagIds: selectedTags,
      dueDate: dueDate || null,
      recurrence,
      showOnWeeklyView,
      checkable: true,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-hairline bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <h2 className="text-[15px] font-semibold">Add Item</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            autoFocus
            className="w-full rounded-lg border border-hairline px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#007AFF]/30"
          />

          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted">Due date (optional)</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value)
                if (e.target.value) setShowOnWeeklyView(true)
              }}
              className="w-full rounded-lg border border-hairline px-3 py-2 text-[13px] focus:outline-none"
            />
          </div>

          <EventCategoryPicker
            categories={categories}
            selectedId={selectedCategory}
            onSelect={setSelectedCategory}
            items={items}
          />

          {tags.length > 0 && (
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-muted">Tags</label>
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => {
                  const selected = selectedTags.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        selected
                          ? 'bg-[#1C1C1E] text-white'
                          : 'bg-[#F2F2F7] text-[#636366] hover:bg-[#E5E5EA]'
                      }`}
                    >
                      {tag.icon && <span className="mr-1">{tag.icon}</span>}
                      {tag.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <RecurrenceFields recurrence={recurrence} onRecurrenceChange={setRecurrence} />

          <label className="flex items-center gap-2 text-[12px] text-[#636366]">
            <input
              type="checkbox"
              checked={showOnWeeklyView}
              onChange={(e) => setShowOnWeeklyView(e.target.checked)}
              className="rounded"
            />
            Weekly view에 표시
          </label>
        </div>

        <div className="flex justify-end border-t border-hairline px-5 py-4">
          <button
            type="button"
            onClick={handleAdd}
            disabled={!title.trim()}
            className="rounded-lg bg-[#007AFF] px-5 py-2 text-[13px] font-medium text-white disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

interface EditItemModalProps {
  item: Item
  items: ItemsActions
  onClose: () => void
  title?: string
}

export function EditItemModal({
  item,
  items,
  onClose,
  title = 'Edit Event',
}: EditItemModalProps) {
  const [draft, setDraft] = useState({ ...item })
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-hairline bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <h2 className="text-[14px] font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 px-4 py-3">
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className="w-full rounded-lg border border-hairline px-3 py-2 text-[13px] focus:outline-none"
          />
          <input
            type="date"
            value={draft.dueDate ?? ''}
            onChange={(e) => setDraft({ ...draft, dueDate: e.target.value || null })}
            className="w-full rounded-lg border border-hairline px-3 py-2 text-[13px] focus:outline-none"
          />
          <input
            type="text"
            value={draft.time ?? ''}
            onChange={(e) => setDraft({ ...draft, time: e.target.value || undefined })}
            placeholder="시간 (선택)"
            className="w-full rounded-lg border border-hairline px-3 py-2 text-[13px] focus:outline-none"
          />
          <EventCategoryPicker
            categories={items.categories}
            selectedId={draft.categoryId}
            onSelect={(categoryId) => setDraft({ ...draft, categoryId })}
            items={items}
            allowManage
          />
          <RecurrenceFields
            recurrence={draft.recurrence}
            onRecurrenceChange={(r) => setDraft({ ...draft, recurrence: r })}
          />
          <label className="flex items-center gap-2 text-[12px]">
            <input
              type="checkbox"
              checked={draft.showOnWeeklyView}
              onChange={(e) => setDraft({ ...draft, showOnWeeklyView: e.target.checked })}
            />
            Weekly view에 표시
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-hairline px-4 py-3">
          {confirmDelete ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  items.deleteItem(item.id)
                  onClose()
                }}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-[11px] text-white"
              >
                Delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="text-[11px] text-muted">
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="text-[11px] text-red-500">
              Delete event
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              items.updateItem(item.id, draft)
              onClose()
            }}
            className="rounded-lg bg-[#007AFF] px-4 py-1.5 text-[12px] font-medium text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
