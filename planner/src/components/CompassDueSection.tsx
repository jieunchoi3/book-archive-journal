import { Compass } from 'lucide-react'
import { COMPASS } from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'

interface CompassDueSectionProps {
  compass: CompassActions
  onOpenCompassAsk: (questionId?: string) => void
}

/** Surfaces due Ask Myself questions on Weekly — Phase 1 in-app notification. */
export function CompassDueSection({
  compass,
  onOpenCompassAsk,
}: CompassDueSectionProps) {
  const due = compass.dueQuestions
  if (due.length === 0) return null

  return (
    <section
      className="mb-4 overflow-hidden rounded-xl border backdrop-blur-md"
      style={{
        borderColor: `${COMPASS.accent}33`,
        background: `${COMPASS.soft}f2`,
      }}
      aria-label="Compass 열린 질문"
    >
      <div
        className="flex items-center gap-2 border-b px-4 py-2.5"
        style={{ borderColor: `${COMPASS.accent}22` }}
      >
        <Compass size={14} style={{ color: COMPASS.accent }} aria-hidden />
        <h2
          className="text-[12px] font-semibold tracking-wide"
          style={{ color: COMPASS.ink }}
        >
          Compass · 열린 질문
        </h2>
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ background: `${COMPASS.accent}22`, color: COMPASS.ink }}
        >
          {due.length}
        </span>
      </div>
      <ul className="flex max-h-40 flex-col gap-1.5 overflow-y-auto px-3 py-2.5">
        {due.map((q) => (
          <li key={q.id} className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-[13px] text-[#1C1B1A]">
              “{q.body}”
            </p>
            <button
              type="button"
              className="shrink-0 text-[12px] font-semibold"
              style={{ color: COMPASS.accent }}
              onClick={() => onOpenCompassAsk(q.id)}
            >
              답하기 →
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
