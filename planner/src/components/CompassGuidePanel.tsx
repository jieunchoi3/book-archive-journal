import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { COMPASS, type ExerciseKey } from '../types/compass'
import { getGuide, type Guide } from '../compass/guides'

interface CompassGuidePanelProps {
  exerciseKey: ExerciseKey | string
  /** Current how[].step key — auto-expands & highlights that section */
  guideStep?: string | null
}

type SectionId = 'what' | 'why' | 'how' | 'tips' | 'traps'

export function CompassGuidePanel({
  exerciseKey,
  guideStep,
}: CompassGuidePanelProps) {
  const guide = getGuide(exerciseKey)
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<SectionId>>(() => new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const savedScroll = useRef(0)
  const howItemRefs = useRef<Record<string, HTMLLIElement | null>>({})

  useEffect(() => {
    if (!open || !guide) return
    const next = new Set<SectionId>(['how'])
    if (!guideStep) next.add('what')
    setExpanded(next)
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = savedScroll.current
      if (guideStep) {
        const el = howItemRefs.current[guideStep]
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    })
  }, [open, guideStep, guide])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!guide) return null

  const toggle = (id: SectionId) => {
    setExpanded((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const close = () => {
    if (scrollRef.current) savedScroll.current = scrollRef.current.scrollTop
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[88px] right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-[#ECE7E2] bg-white text-[18px] font-semibold text-[#5A5550] shadow-md sm:right-6"
        aria-label="가이드 열기"
      >
        ?
      </button>

      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default bg-transparent"
          aria-label="가이드 닫기"
          onClick={close}
        />
      )}

      <aside
        className={`fixed z-50 flex flex-col bg-white shadow-[-8px_0_24px_rgba(28,27,26,.08)] transition-transform duration-300 ease-out max-lg:inset-x-0 max-lg:bottom-0 max-lg:h-[80vh] max-lg:rounded-t-[20px] lg:inset-y-0 lg:right-0 lg:h-full lg:w-[420px] ${
          open
            ? 'translate-y-0 lg:translate-x-0'
            : 'translate-y-full pointer-events-none lg:translate-x-full lg:translate-y-0'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={`${guide.title} 가이드`}
        aria-hidden={!open}
      >
        <header className="shrink-0 border-b border-[#ECE7E2] px-5 pb-3 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-bold text-[#1C1B1A]">
                {guide.title}
              </h2>
              <p className="mt-1 text-[12px] text-[#B5AFA8]">
                {guide.duration} · {guide.cadence}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              className="rounded-lg p-1.5 text-[#8A847E] hover:bg-[#FAF8F6]"
              aria-label="닫기"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <GuideSection
            title="뭐 하는 거야"
            open={expanded.has('what')}
            onToggle={() => toggle('what')}
          >
            <p className="whitespace-pre-wrap text-[15px] leading-[1.7] text-[#1C1B1A]">
              {guide.what}
            </p>
          </GuideSection>

          <GuideSection
            title="왜 하는 거야"
            open={expanded.has('why')}
            onToggle={() => toggle('why')}
          >
            <p className="whitespace-pre-wrap text-[15px] leading-[1.7] text-[#1C1B1A]">
              {guide.why}
            </p>
          </GuideSection>

          <GuideSection
            title="어떻게 해"
            open={expanded.has('how')}
            onToggle={() => toggle('how')}
          >
            <HowList
              guide={guide}
              guideStep={guideStep}
              itemRefs={howItemRefs}
            />
          </GuideSection>

          <GuideSection
            title="잘 되는 법"
            open={expanded.has('tips')}
            onToggle={() => toggle('tips')}
          >
            <ul className="space-y-2 text-[15px] leading-[1.7] text-[#1C1B1A]">
              {guide.tips.map((t) => (
                <li key={t}>· {t}</li>
              ))}
            </ul>
          </GuideSection>

          <GuideSection
            title="이럴 때 망해"
            open={expanded.has('traps')}
            onToggle={() => toggle('traps')}
          >
            <ul className="space-y-2 text-[15px] leading-[1.7] text-[#1C1B1A]">
              {guide.traps.map((t) => (
                <li key={t}>· {t}</li>
              ))}
            </ul>
          </GuideSection>
        </div>
      </aside>
    </>
  )
}

function GuideSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className="mb-2 border-b border-[#ECE7E2] pb-2 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 py-2.5 text-left"
      >
        <span className="text-[13px] text-[#B5AFA8]" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
        <span className="text-[14px] font-semibold text-[#8A847E]">{title}</span>
      </button>
      {open && <div className="pb-3 pl-5">{children}</div>}
    </section>
  )
}

function HowList({
  guide,
  guideStep,
  itemRefs,
}: {
  guide: Guide
  guideStep?: string | null
  itemRefs: MutableRefObject<Record<string, HTMLLIElement | null>>
}) {
  return (
    <ol className="space-y-2">
      {guide.how.map((h, i) => {
        const active = guideStep === h.step
        return (
          <li
            key={h.step}
            ref={(el) => {
              itemRefs.current[h.step] = el
            }}
            className={`rounded-xl px-3 py-2.5 text-[15px] leading-[1.7] ${
              active ? 'font-medium' : 'text-[#1C1B1A]'
            }`}
            style={
              active
                ? {
                    background: COMPASS.soft,
                    color: COMPASS.ink,
                    boxShadow: `inset 3px 0 0 ${COMPASS.accent}`,
                  }
                : undefined
            }
          >
            <span className="tabular-nums text-[#8A847E]">{i + 1}. </span>
            {h.body}
          </li>
        )
      })}
    </ol>
  )
}

/** Always-visible one-liner under a step title. */
export function GuideInlineHint({
  exerciseKey,
  step,
  className = '',
}: {
  exerciseKey: ExerciseKey | string
  step?: string | null
  className?: string
}) {
  const text = (() => {
    const guide = getGuide(exerciseKey)
    if (!guide) return null
    if (step) {
      const how = guide.how.find((h) => h.step === step)
      if (how) return how.body
    }
    return null
  })()
  if (!text) return null
  return (
    <p
      className={`text-[14px] leading-relaxed text-[#8A847E] ${className}`}
    >
      {text}
    </p>
  )
}
