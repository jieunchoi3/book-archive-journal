import { useState } from 'react'
import { Star } from 'lucide-react'

interface RatingPromptModalProps {
  bookTitle: string
  onSave: (rating: number) => void
  onClose: () => void
}

export function RatingPromptModal({
  bookTitle,
  onSave,
  onClose,
}: RatingPromptModalProps) {
  const [hoverRating, setHoverRating] = useState(0)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-black/10 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative w-full max-w-[360px] rounded-2xl border border-neutral-100 bg-white/95 p-8 shadow-2xl backdrop-blur-md"
        role="dialog"
        aria-modal
        aria-labelledby="rating-prompt-title"
      >
        <h2
          id="rating-prompt-title"
          className="text-center text-base font-semibold tracking-[-0.02em] text-black"
        >
          How would you rate this book?
        </h2>
        <p className="mt-2 text-center text-sm text-apple-gray-400">
          {bookTitle}
        </p>

        <div
          className="mt-8 flex justify-center gap-2"
          onMouseLeave={() => setHoverRating(0)}
        >
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHoverRating(star)}
              onClick={() => onSave(star)}
              className="rounded-lg p-1 transition-transform hover:scale-110"
              aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
            >
              <Star
                size={28}
                strokeWidth={1.5}
                className={
                  star <= hoverRating
                    ? 'fill-neutral-700 text-neutral-700'
                    : 'fill-transparent text-apple-gray-100'
                }
              />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full text-center text-xs font-medium tracking-[0.08em] text-apple-gray-400 uppercase transition-colors hover:text-black"
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
