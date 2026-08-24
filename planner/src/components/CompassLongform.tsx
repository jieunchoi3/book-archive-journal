import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  COMPASS,
  emptyLongformData,
  normalizeLongformData,
  type LongformData,
  type ExerciseKey,
} from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import {
  ExerciseChrome,
  useDebouncedDraftSave,
  useExerciseSnapshot,
  cardShadow,
} from './CompassExerciseShell'

const WORK_CHIPS = [
  '일은 나에게 무엇인가',
  '왜 일하는가',
  '돈은 어디에 놓이나',
  '좋은 일과 나쁜 일을 가르는 기준',
  '일과 나머지 삶의 관계',
]

const LIFE_CHIPS = [
  '무엇이 삶을 의미 있게 만드나',
  '나보다 큰 무엇이 있나',
  '옳고 그름의 기준',
  '기쁨은 어디서 오나',
  '타인은 내 삶에서 어떤 자리인가',
]

const SERIF =
  '"Noto Serif KR", Georgia, "Times New Roman", serif'

interface CompassLongformProps {
  kind: 'workview' | 'lifeview'
  compass: CompassActions
  snapshotId?: string
  onNavigateSnapshot: (id: string | undefined) => void
  onCompare?: (ids: [string, string]) => void
  onRequestSnapshotAi?: (snapshotId: string) => void
}

function serializeEditor(root: HTMLElement): {
  body: string
  chips_used: string[]
} {
  const clone = root.cloneNode(true) as HTMLElement
  const hints = clone.querySelectorAll('.prompt-hint')
  const chips_used: string[] = []
  hints.forEach((h) => {
    const t = (h.textContent ?? '').trim()
    if (t) chips_used.push(t)
    h.remove()
  })
  // Normalize block breaks to paragraphs
  const html = clone.innerHTML
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
  const body = html
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { body, chips_used: [...new Set(chips_used)] }
}

function unwrapEditedHints(root: HTMLElement) {
  root.querySelectorAll('.prompt-hint').forEach((span) => {
    const original = span.getAttribute('data-chip') ?? ''
    const text = span.textContent ?? ''
    if (text !== original) {
      const parent = span.parentNode
      if (!parent) return
      while (span.firstChild) parent.insertBefore(span.firstChild, span)
      parent.removeChild(span)
    }
  })
}

export function CompassLongform({
  kind,
  compass,
  snapshotId,
  onNavigateSnapshot,
  onCompare,
  onRequestSnapshotAi,
}: CompassLongformProps) {
  const key = kind as ExerciseKey
  const { all, completes, active, ensureDraft, readonly } = useExerciseSnapshot(
    compass,
    key,
    snapshotId,
    onNavigateSnapshot,
  )
  const [data, setData] = useState<LongformData>(emptyLongformData())
  const [lockedMsg, setLockedMsg] = useState(false)
  const [sideBySide, setSideBySide] = useState(false)
  const [focused, setFocused] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const skipHydrate = useRef(false)
  const chips = kind === 'workview' ? WORK_CHIPS : LIFE_CHIPS

  useEffect(() => {
    if (!active) {
      setData(emptyLongformData())
      return
    }
    if (skipHydrate.current) {
      skipHydrate.current = false
      return
    }
    const next = normalizeLongformData(
      compass.getDraftData(active, emptyLongformData()),
    )
    setData(next)
    setLockedMsg(false)
    requestAnimationFrame(() => {
      const el = editorRef.current
      if (!el || readonly) return
      if (document.activeElement === el) return
      el.textContent = next.body
    })
  }, [active, compass, readonly])

  useEffect(() => {
    if (!readonly || !editorRef.current) return
    editorRef.current.textContent = data.body
  }, [readonly, data.body, active?.id])

  const save = useCallback(
    async (id: string, next: LongformData) => {
      await compass.updateDraftData(id, next as unknown as Record<string, unknown>)
    },
    [compass],
  )

  const { savedAt, error } = useDebouncedDraftSave(
    active,
    data,
    save,
    Boolean(active && !readonly),
  )

  const syncFromDom = () => {
    const el = editorRef.current
    if (!el || readonly) return
    unwrapEditedHints(el)
    const { body, chips_used } = serializeEditor(el)
    // Keep chips that still have untouched hints OR were in chips_used and still marked
    const hintChips = chips_used
    setData({
      body,
      chips_used: [...new Set([...hintChips])],
    })
  }

  const prev =
    active?.status === 'complete'
      ? completes[completes.findIndex((s) => s.id === active.id) - 1]
      : completes[completes.length - 1]
  const prevBody =
    (prev ? normalizeLongformData(prev.data).body : '') ?? ''

  const insertOrToggleChip = (chip: string) => {
    if (readonly) {
      setLockedMsg(true)
      return
    }
    const el = editorRef.current
    if (!el) return
    el.focus()

    const existing = el.querySelector(
      `.prompt-hint[data-chip="${CSS.escape(chip)}"]`,
    )
    if (existing) {
      existing.remove()
      skipHydrate.current = true
      syncFromDom()
      return
    }

    const sel = window.getSelection()
    const span = document.createElement('span')
    span.className = 'prompt-hint'
    span.setAttribute('data-chip', chip)
    span.textContent = chip

    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0)
      range.deleteContents()
      const br = document.createElement('br')
      range.insertNode(br)
      range.setStartAfter(br)
      range.insertNode(span)
      range.setStartAfter(span)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    } else {
      el.appendChild(document.createElement('br'))
      el.appendChild(span)
    }

    skipHydrate.current = true
    setData((d) => ({
      ...serializeEditor(el),
      chips_used: [...new Set([...d.chips_used, chip])],
    }))
  }

  const charCount = data.body.length

  const paragraphs = useMemo(
    () => data.body.split(/\n\n+/).filter((p) => p.length > 0),
    [data.body],
  )
  const prevParagraphs = useMemo(
    () => prevBody.split(/\n\n+/).filter((p) => p.length > 0),
    [prevBody],
  )
  const maxPara = Math.max(paragraphs.length, prevParagraphs.length)

  const cadence =
    kind === 'workview' || kind === 'lifeview'
      ? '보통 6개월마다 다시 해요'
      : ''

  const helpText =
    kind === 'workview'
      ? `일이 나에게 무엇인지, 왜 일하는지, 돈과 삶의 경계를 천천히 적어 보는 자리예요. 오른쪽 칩을 누르면 회색 질문이 들어가고, 답을 쓰기 시작하면 본문이 됩니다. 건드리지 않은 질문은 저장되지 않아요. ${cadence}`
      : `무엇이 삶을 의미 있게 만드는지 길게 쓰는 자리예요. 생각 유도 칩은 힌트일 뿐이고, 쓰지 않은 질문은 기록에 남지 않아요. ${cadence}`

  const ChipList = ({ mobile }: { mobile?: boolean }) => (
    <div className={mobile ? 'flex gap-2 overflow-x-auto pb-1' : 'flex flex-col gap-2'}>
      {chips.map((c) => {
        const used = data.chips_used.includes(c)
        return (
          <button
            key={c}
            type="button"
            onClick={() => insertOrToggleChip(c)}
            className={
              mobile
                ? 'shrink-0 rounded-xl border px-4 py-3 text-left text-[14px] transition-colors'
                : 'w-full rounded-xl border px-4 py-3 text-left text-[14px] transition-colors'
            }
            style={{
              borderColor: used ? COMPASS.line : '#ECE7E2',
              background: used ? COMPASS.soft : '#FFF',
              color: '#1C1B1A',
            }}
          >
            {used ? `✓ ${c}` : c}
          </button>
        )
      })}
    </div>
  )

  return (
    <ExerciseChrome
      exerciseKey={key}
      compass={compass}
      all={all}
      active={active}
      onNavigateSnapshot={onNavigateSnapshot}
      onCompare={onCompare}
      onRequestSnapshotAi={onRequestSnapshotAi}
      onCreateNew={() => void ensureDraft(true)}
      savedAt={savedAt}
      error={error}
      help={helpText}
      helpCadence={cadence}
      lockedMsg={lockedMsg}
      onComplete={() => {
        // Final strip of any leftover hints before complete
        const el = editorRef.current
        if (el) {
          el.querySelectorAll('.prompt-hint').forEach((h) => h.remove())
          const { body } = serializeEditor(el)
          if (active) {
            void compass
              .updateDraftData(active.id, {
                body,
                chips_used: data.chips_used,
              } as unknown as Record<string, unknown>)
              .then(() => compass.completeSnapshot(active.id))
            return
          }
        }
        if (active) void compass.completeSnapshot(active.id)
      }}
    >
      {readonly && prev && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setSideBySide((v) => !v)}
            className="rounded-full px-3 py-1.5 text-[12px] font-semibold"
            style={{ background: COMPASS.soft, color: COMPASS.ink }}
          >
            {sideBySide ? '한 화면으로' : '이전 버전과 나란히 보기'}
          </button>
        </div>
      )}

      {/* Mobile chips above editor */}
      {!readonly && (
        <div className="mb-4 lg:hidden">
          <p className="mb-2 text-[12px] font-semibold text-[#8A847E]">생각 유도</p>
          <ChipList mobile />
        </div>
      )}

      <div
        className="mx-auto grid w-full gap-10"
        style={{
          maxWidth: 1080,
          gridTemplateColumns: readonly || sideBySide ? '1fr' : undefined,
        }}
      >
        <div
          className={
            readonly
              ? 'w-full'
              : 'grid grid-cols-1 justify-center gap-10 lg:grid-cols-[720px_260px]'
          }
        >
          <div className="relative min-w-0">
            {sideBySide && readonly ? (
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-[11px] font-semibold text-[#8A847E]">그때</p>
                  {Array.from({ length: maxPara }).map((_, i) => (
                    <p
                      key={`p-${i}`}
                      className="mb-3 text-[18px] leading-[1.75] tracking-[-0.01em] text-[#5A5550]"
                      style={{
                        fontFamily: SERIF,
                        minHeight: prevParagraphs[i] || paragraphs[i] ? undefined : 28,
                      }}
                    >
                      {prevParagraphs[i] ?? ''}
                    </p>
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-semibold text-[#8A847E]">지금</p>
                  {Array.from({ length: maxPara }).map((_, i) => {
                    const p = paragraphs[i] ?? ''
                    const changed = (prevParagraphs[i] ?? '') !== p && p.length > 0
                    return (
                      <p
                        key={`c-${i}`}
                        className="mb-3 border-l-[3px] pl-3 text-[18px] leading-[1.75] tracking-[-0.01em] text-[#1C1B1A]"
                        style={{
                          fontFamily: SERIF,
                          borderColor: changed ? COMPASS.accent : 'transparent',
                          minHeight: prevParagraphs[i] || p ? undefined : 28,
                        }}
                      >
                        {p}
                      </p>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div
                className="relative rounded-[18px] border bg-white transition-[border-color] duration-150"
                style={{
                  boxShadow: cardShadow,
                  borderColor: focused ? COMPASS.line : '#ECE7E2',
                  padding: 40,
                }}
              >
                <div
                  ref={editorRef}
                  role="textbox"
                  aria-multiline
                  aria-label={kind === 'workview' ? '일 관점' : '삶 관점'}
                  contentEditable={!readonly}
                  suppressContentEditableWarning
                  onFocus={() => setFocused(true)}
                  onBlur={() => {
                    setFocused(false)
                    syncFromDom()
                  }}
                  onInput={() => {
                    if (readonly) {
                      setLockedMsg(true)
                      return
                    }
                    skipHydrate.current = true
                    syncFromDom()
                  }}
                  data-placeholder="여기에 쓰기…"
                  className="compass-longform-editor min-h-[420px] w-full text-[18px] leading-[1.75] tracking-[-0.01em] text-[#1C1B1A] outline-none empty:before:pointer-events-none empty:before:text-[#B5AFA8] empty:before:content-[attr(data-placeholder)]"
                  style={{
                    fontFamily: SERIF,
                    opacity: readonly ? 0.9 : 1,
                  }}
                />
                {!readonly && (
                  <div className="pointer-events-none absolute bottom-4 right-5 flex items-center gap-2 text-[12px] text-[#8A847E]">
                    <span>{charCount}자</span>
                    {charCount < 250 && (
                      <span className="text-[#B5AFA8]">250자쯤 되면 충분해요</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {!readonly && (
            <aside className="sticky top-6 hidden self-start lg:block">
              <p className="mb-3 text-[12px] font-semibold text-[#8A847E]">생각 유도</p>
              <ChipList />
            </aside>
          )}
        </div>
      </div>
    </ExerciseChrome>
  )
}
