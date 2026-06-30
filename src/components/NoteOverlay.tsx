import { useEffect, useState } from 'react'
import type { Book } from '../types'
import { BookEditorForm } from './BookEditorForm'

interface NoteOverlayProps {
  availableTags: string[]
  onClose: () => void
  onSave: (book: Book) => void
}

export function NoteOverlay({ availableTags, onClose, onSave }: NoteOverlayProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className={`absolute inset-0 bg-black/5 backdrop-blur-md transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
        aria-hidden
      />

      <div
        className={`relative flex max-h-[calc(90vh*1.2)] w-full max-w-[593px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-300 ease-out ${
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        role="dialog"
        aria-modal
        aria-label="Add new book"
      >
        <BookEditorForm
          book={null}
          isNew
          availableTags={availableTags}
          onClose={handleClose}
          onSave={onSave}
          onDelete={() => {}}
        />
      </div>
    </div>
  )
}
