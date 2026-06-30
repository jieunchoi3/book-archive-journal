import type { Book } from '../types'
import { BookEditorForm } from './BookEditorForm'

interface BookDetailPageProps {
  book: Book
  availableTags: string[]
  onClose: () => void
  onSave: (book: Book) => void
  onDelete: (id: string) => void
}

export function BookDetailPage({
  book,
  availableTags,
  onClose,
  onSave,
  onDelete,
}: BookDetailPageProps) {
  return (
    <div className="fixed inset-0 z-50 flex min-h-screen flex-col bg-white">
      <BookEditorForm
        book={book}
        isNew={false}
        availableTags={availableTags}
        onClose={onClose}
        onSave={onSave}
        onDelete={onDelete}
      />
    </div>
  )
}
