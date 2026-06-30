import { Star } from 'lucide-react'

interface StarRatingProps {
  value?: number
  onChange: (rating: number | undefined) => void
  disabled?: boolean
}

export function StarRating({ value, onChange, disabled }: StarRatingProps) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(value === star ? undefined : star)}
          className="group transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
        >
          <Star
            size={18}
            strokeWidth={1.5}
            className={`transition-colors ${
              value && star <= value
                ? 'fill-black text-black'
                : 'fill-transparent text-apple-gray-100 group-hover:text-apple-gray-400'
            }`}
          />
        </button>
      ))}
      {value === undefined && (
        <span className="ml-2 text-[10px] uppercase tracking-[0.1em] text-apple-gray-400">
          Optional
        </span>
      )}
    </div>
  )
}
