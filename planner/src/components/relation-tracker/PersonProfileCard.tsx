import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Briefcase,
  Calendar,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  BookOpen,
  Trash2,
  Users,
} from 'lucide-react'
import type { RelationPerson } from '../../types/relationTracker'
import { MiiAvatar } from './MiiAvatar'

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

interface PersonProfileCardProps {
  person: RelationPerson
  compact?: boolean
  /** Speech-bubble tail when anchored to an avatar on the room canvas. */
  anchor?: 'above' | 'below'
  onClose?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export function PersonProfileCard({
  person,
  compact,
  anchor,
  onEdit,
  onDelete,
}: PersonProfileCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const handleDelete = () => {
    setMenuOpen(false)
    const ok = window.confirm(
      `Remove ${person.name} from your room? You can invite them again later.`,
    )
    if (ok) onDelete?.()
  }

  const showTail = !compact && anchor
  return (
    <div
      className={`relative w-[min(280px,calc(100vw-2rem))] rounded-2xl bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)] ${
        compact ? 'p-4' : 'p-5'
      }`}
    >
      {showTail && anchor === 'above' && (
        <div
          className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-white shadow-sm"
          aria-hidden
        />
      )}
      {showTail && anchor === 'below' && (
        <div
          className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-white shadow-sm"
          aria-hidden
        />
      )}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-serif text-[20px] font-semibold leading-tight text-[#1C1C1E]">
            {person.name}
          </h3>
          <p className="text-[13px] text-muted">{person.relationshipType}</p>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-full p-1 text-muted hover:bg-surface"
            aria-label="More options"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && onDelete && (
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] overflow-hidden rounded-xl border border-hairline bg-white py-1 shadow-lg">
              <button
                type="button"
                onClick={handleDelete}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#FF3B30] hover:bg-[#FF3B30]/5"
              >
                <Trash2 size={16} />
                Remove from room
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="mb-3 flex gap-3">
        <MiiAvatar avatar={person.avatar} size={56} />
        <ul className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 text-[12px] text-[#48484A]">
          {person.occupation && (
            <li className="flex items-center gap-2">
              <Briefcase size={14} className="shrink-0 text-muted" />
              <span className="truncate">{person.occupation}</span>
            </li>
          )}
          {person.location && (
            <li className="flex items-center gap-2">
              <MapPin size={14} className="shrink-0 text-muted" />
              <span className="truncate">{person.location}</span>
            </li>
          )}
          {person.metContext && (
            <li className="flex items-center gap-2">
              <Users size={14} className="shrink-0 text-muted" />
              <span className="truncate">{person.metContext}</span>
            </li>
          )}
          {person.metDate && (
            <li className="flex items-center gap-2">
              <Calendar size={14} className="shrink-0 text-muted" />
              <span>{formatDate(person.metDate)}</span>
            </li>
          )}
        </ul>
      </div>
      {person.quote && (
        <>
          <div className="mb-2 border-t border-hairline" />
          <p className="font-serif text-[14px] italic leading-relaxed text-[#636366]">
            &ldquo;{person.quote}&rdquo;
          </p>
        </>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <ActionChip icon={<MessageCircle size={14} />} label="View" />
        <ActionChip
          icon={<Pencil size={14} />}
          label="Edit"
          onClick={onEdit}
        />
        <ActionChip icon={<BookOpen size={14} />} label="Add memory" />
      </div>
    </div>
  )
}

function ActionChip({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode
  label: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white px-3 py-1.5 text-[12px] font-medium text-[#48484A] transition hover:bg-surface"
    >
      {icon}
      {label}
    </button>
  )
}
