import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface WishlistPhotoCarouselProps {
  images: string[]
  className?: string
  emptyLabel?: string
  showArrows?: boolean
  activeIndex?: number
  onActiveIndexChange?: (index: number) => void
}

export function WishlistPhotoCarousel({
  images,
  className = '',
  emptyLabel = 'No photo',
  showArrows = true,
  activeIndex: controlledIndex,
  onActiveIndexChange,
}: WishlistPhotoCarouselProps) {
  const [internalIndex, setInternalIndex] = useState(0)
  const touchStartX = useRef(0)
  const count = images.length
  const index = controlledIndex ?? internalIndex
  const safeIndex = count > 0 ? Math.min(index, count - 1) : 0

  useEffect(() => {
    if (controlledIndex != null || count === 0) return
    setInternalIndex((i) => Math.min(i, count - 1))
  }, [controlledIndex, count])

  const setIndex = useCallback(
    (next: number | ((prev: number) => number)) => {
      const current = controlledIndex ?? internalIndex
      const value = typeof next === 'function' ? next(current) : next
      if (onActiveIndexChange) onActiveIndexChange(value)
      else setInternalIndex(value)
    },
    [controlledIndex, internalIndex, onActiveIndexChange],
  )

  const goPrev = useCallback(() => {
    if (count <= 1) return
    setIndex((i) => (i - 1 + count) % count)
  }, [count])

  const goNext = useCallback(() => {
    if (count <= 1) return
    setIndex((i) => (i + 1) % count)
  }, [count])

  if (count === 0) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center text-[10px] text-muted ${className}`}
      >
        {emptyLabel}
      </div>
    )
  }

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className}`}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? 0
      }}
      onTouchEnd={(e) => {
        const endX = e.changedTouches[0]?.clientX ?? 0
        const dx = endX - touchStartX.current
        if (dx < -40) goNext()
        else if (dx > 40) goPrev()
      }}
    >
      <img
        src={images[safeIndex]}
        alt=""
        className="h-full w-full object-cover"
        draggable={false}
      />

      {count > 1 && showArrows && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              goPrev()
            }}
            className="absolute left-1 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-1 text-[#48484A] shadow-sm backdrop-blur-sm hover:bg-white sm:block"
            aria-label="Previous photo"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              goNext()
            }}
            className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-1 text-[#48484A] shadow-sm backdrop-blur-sm hover:bg-white sm:block"
            aria-label="Next photo"
          >
            <ChevronRight size={14} />
          </button>
        </>
      )}

      {count > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setIndex(i)
              }}
              className={`h-1.5 rounded-full transition-all ${
                i === safeIndex ? 'w-3 bg-white' : 'w-1.5 bg-white/50'
              }`}
              aria-label={`Photo ${i + 1} of ${count}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
