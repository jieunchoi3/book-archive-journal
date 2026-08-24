import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  COMPASS,
  emptyLongformData,
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

interface CompassLongformProps {
  kind: 'workview' | 'lifeview'
  compass: CompassActions
  snapshotId?: string
  onNavigateSnapshot: (id: string | undefined) => void
  onCompare?: (ids: [string, string]) => void
}

export function CompassLongform({
  kind,
  compass,
  snapshotId,
  onNavigateSnapshot,
  onCompare,
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
  const taRef = useRef<HTMLTextAreaElement>(null)
  const chips = kind === 'workview' ? WORK_CHIPS : LIFE_CHIPS

  useEffect(() => {
    if (!active) {
      setData(emptyLongformData())
      return
    }
    setData(compass.getDraftData(active, emptyLongformData()))
    setLockedMsg(false)
  }, [active, compass])

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

  const prev =
    active?.status === 'complete'
      ? completes[completes.findIndex((s) => s.id === active.id) - 1]
      : completes[completes.length - 1]
  const prevBody = (prev?.data as unknown as LongformData | undefined)?.body ?? ''

  const insertChip = (chip: string) => {
    if (readonly) {
      setLockedMsg(true)
      return
    }
    const el = taRef.current
    const insert = `\n\n[${chip}]\n`
    if (!el) {
      setData((d) => ({
        ...d,
        body: d.body + insert,
        promptsUsed: [...d.promptsUsed, chip],
      }))
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = data.body.slice(0, start) + insert + data.body.slice(end)
    setData((d) => ({
      ...d,
      body: next,
      promptsUsed: [...d.promptsUsed, chip],
    }))
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + insert.length
      el.setSelectionRange(pos, pos)
    })
  }

  const paragraphs = useMemo(
    () => data.body.split(/\n\n+/).filter(Boolean),
    [data.body],
  )
  const prevParagraphs = useMemo(
    () => prevBody.split(/\n\n+/).filter(Boolean),
    [prevBody],
  )

  return (
    <ExerciseChrome
      exerciseKey={key}
      compass={compass}
      all={all}
      active={active}
      onNavigateSnapshot={onNavigateSnapshot}
      onCompare={onCompare}
      onCreateNew={() => void ensureDraft(true)}
      savedAt={savedAt}
      error={error}
      help={
        kind === 'workview'
          ? '일이 나에게 무엇인지 길게 쓰는 자리예요. 생각 유도 칩을 누르면 회색 프롬프트가 들어가요.'
          : '삶을 의미 있게 만드는 것을 길게 쓰는 자리예요.'
      }
      lockedMsg={lockedMsg}
      onComplete={() => active && void compass.completeSnapshot(active.id)}
    >
      {readonly && prev && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setSideBySide((v) => !v)}
            className="rounded-full px-3 py-1.5 text-[12px] font-semibold"
            style={{ background: COMPASS.soft, color: COMPASS.ink }}
          >
            {sideBySide ? '한 화면으로' : '문단 단위 나란히 보기'}
          </button>
        </div>
      )}

      <div className="relative mx-auto flex max-w-[720px] gap-4">
        <div className="min-w-0 flex-1">
          {sideBySide && readonly ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[11px] font-semibold text-[#8A847E]">그때</p>
                {prevParagraphs.map((p, i) => (
                  <p
                    key={i}
                    className="mb-3 font-serif text-[18px] leading-[1.75] text-[#5A5550]"
                  >
                    {p}
                  </p>
                ))}
              </div>
              <div>
                <p className="mb-2 text-[11px] font-semibold text-[#8A847E]">지금</p>
                {paragraphs.map((p, i) => {
                  const changed = prevParagraphs[i] !== p
                  return (
                    <p
                      key={i}
                      className="mb-3 border-l-2 pl-3 font-serif text-[18px] leading-[1.75] text-[#1C1B1A]"
                      style={{ borderColor: changed ? COMPASS.accent : 'transparent' }}
                    >
                      {p}
                    </p>
                  )
                })}
              </div>
            </div>
          ) : (
            <textarea
              ref={taRef}
              disabled={readonly}
              value={data.body}
              onChange={(e) => {
                if (readonly) {
                  setLockedMsg(true)
                  return
                }
                setData((d) => ({ ...d, body: e.target.value }))
              }}
              rows={16}
              placeholder="여기에 쓰기…"
              className="w-full resize-y rounded-[18px] border border-[#ECE7E2] bg-white px-5 py-4 font-serif text-[18px] leading-[1.75] text-[#1C1B1A] placeholder:text-[#B5AFA8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E] disabled:opacity-80"
              style={{ boxShadow: cardShadow }}
            />
          )}
          <div className="mt-2 flex items-center justify-end gap-2 text-[12px] text-[#8A847E]">
            <span>{data.body.length}자</span>
            {data.body.length >= 250 && <span>250자 넘으면 충분해요</span>}
          </div>
        </div>

        {!readonly && (
          <aside className="sticky top-4 hidden w-44 shrink-0 self-start lg:block">
            <p className="mb-2 text-[11px] font-semibold tracking-wider text-[#8A847E]">
              생각 유도
            </p>
            <div className="flex flex-col gap-1.5">
              {chips.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => insertChip(c)}
                  className="rounded-xl bg-[#FAF8F6] px-2.5 py-2 text-left text-[12px] text-[#5A5550] hover:bg-[#E8EFEB]"
                >
                  {c}
                </button>
              ))}
            </div>
          </aside>
        )}
      </div>

      {!readonly && (
        <div className="mt-4 flex flex-wrap gap-1.5 lg:hidden">
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => insertChip(c)}
              className="rounded-full bg-[#FAF8F6] px-3 py-1.5 text-[12px] text-[#5A5550]"
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </ExerciseChrome>
  )
}
