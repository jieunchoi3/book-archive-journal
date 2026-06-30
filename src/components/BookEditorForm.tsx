import { useEffect, useState } from 'react'
import { ChevronLeft, Trash2 } from 'lucide-react'
import type { Book } from '../types'
import { BasicInfoSection } from './BasicInfoSection'
import { NoteCanvas } from './NoteCanvas'

export function createEmptyBook(): Book {
  return {
    id: crypto.randomUUID(),
    title: '',
    author: '',
    currentlyReading: false,
    tags: [],
    notes: [],
    addedAt: new Date().toISOString().split('T')[0],
  }
}

interface BookEditorFormProps {
  book: Book | null
  isNew: boolean
  availableTags?: string[]
  onClose: () => void
  onSave: (book: Book) => void
  onDelete: (id: string) => void
}

export function BookEditorForm({
  book,
  isNew,
  availableTags = [],
  onClose,
  onSave,
  onDelete,
}: BookEditorFormProps) {
  const [draft, setDraft] = useState<Book>(book ?? createEmptyBook())

  useEffect(() => {
    setDraft(book ?? createEmptyBook())
  }, [book])

  const handleSave = () => {
    onSave(draft)
    onClose()
  }

  const handleDelete = () => {
    if (!isNew && draft.id) {
      onDelete(draft.id)
    }
    onClose()
  }

  const updateDraft = (updates: Partial<Book>) => {
    setDraft((prev) => ({ ...prev, ...updates }))
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-zinc-100 px-8 py-5">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs font-medium tracking-[0.08em] text-apple-gray-400 uppercase transition-colors hover:text-black"
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
          Back / Main Page
        </button>

        <div className="flex items-center gap-4">
          {!isNew && (
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1.5 rounded-lg border border-apple-gray-100 px-3 py-2 text-xs font-medium text-apple-gray-400 transition-colors hover:border-black hover:text-black"
              aria-label="Delete book"
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-black px-5 py-2 text-xs font-semibold tracking-[0.06em] text-white uppercase transition-opacity hover:opacity-80"
          >
            Save Changes
          </button>
        </div>
      </div>

      <div className={isNew ? 'overflow-x-hidden overflow-y-auto' : 'flex flex-1 flex-col overflow-hidden'}>
        <BasicInfoSection
          book={draft}
          onChange={updateDraft}
          defaultCollapsed={!isNew}
          availableTags={availableTags}
        />

        {!isNew && (
          <div className="flex min-h-0 flex-1 flex-col">
            <h3 className="shrink-0 border-b border-zinc-100 px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-apple-gray-400 md:pl-6 md:pr-8">
              Note Taking Canvas
            </h3>
            <NoteCanvas
              bookId={draft.id}
              notes={draft.notes}
              onChange={(notes) => updateDraft({ notes })}
            />
          </div>
        )}
      </div>
    </>
  )
}
