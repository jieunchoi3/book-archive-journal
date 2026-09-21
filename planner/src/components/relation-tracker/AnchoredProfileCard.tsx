import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RelationPerson } from '../../types/relationTracker'
import { PersonProfileCard } from './PersonProfileCard'

interface AnchoredProfileCardProps {
  anchorEl: HTMLElement | null
  person: RelationPerson
  onEdit?: () => void
  onDelete?: () => void
}

/** Renders profile card in a top-layer portal, positioned near the avatar. */
export function AnchoredProfileCard({
  anchorEl,
  person,
  onEdit,
  onDelete,
}: AnchoredProfileCardProps) {
  const [pos, setPos] = useState<{
    left: number
    top: number
    placeBelow: boolean
  } | null>(null)

  useLayoutEffect(() => {
    if (!anchorEl) {
      setPos(null)
      return
    }

    const update = () => {
      const rect = anchorEl.getBoundingClientRect()
      const cardW = Math.min(280, window.innerWidth - 32)
      const centerX = rect.left + rect.width / 2
      let left = centerX - cardW / 2
      left = Math.max(16, Math.min(left, window.innerWidth - cardW - 16))

      const placeBelow = rect.top < window.innerHeight * 0.45
      const gap = 12
      const top = placeBelow ? rect.bottom + gap : rect.top - gap

      setPos({ left, top, placeBelow })
    }

    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [anchorEl, person.id])

  if (!anchorEl || !pos) return null

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[100]"
      aria-hidden={false}
    >
      <div
        className="pointer-events-auto absolute max-w-[calc(100vw-2rem)]"
        style={{
          left: pos.left,
          top: pos.top,
          width: Math.min(280, window.innerWidth - 32),
          transform: pos.placeBelow ? undefined : 'translateY(-100%)',
        }}
      >
        <PersonProfileCard
          person={person}
          anchor={pos.placeBelow ? 'below' : 'above'}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </div>,
    document.body,
  )
}
