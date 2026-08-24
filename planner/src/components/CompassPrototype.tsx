import { useMemo, useState } from 'react'
import { COMPASS, todayKey, type LdPrototype, type PrototypeKind } from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import { cardShadow } from './CompassExerciseShell'
import { MessageCircle, Sparkles } from 'lucide-react'

interface CompassPrototypeProps {
  compass: CompassActions
  initialPlanLink?: string | null
}

export function CompassPrototype({ compass, initialPlanLink }: CompassPrototypeProps) {
  const [seg, setSeg] = useState<'conversation' | 'experience' | 'all'>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [goal, setGoal] = useState(3)
  const [draft, setDraft] = useState({
    kind: 'conversation' as PrototypeKind,
    title: '',
    person: '',
    linkedPlan: initialPlanLink ?? '',
  })

  const list = useMemo(() => {
    let items = [...compass.prototypes].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    )
    if (seg !== 'all') items = items.filter((p) => p.kind === seg)
    return items
  }, [compass.prototypes, seg])

  const quarterStart = useMemo(() => {
    const d = new Date()
    const q = Math.floor(d.getMonth() / 3) * 3
    return new Date(d.getFullYear(), q, 1)
  }, [])

  const quarterConvos = compass.prototypes.filter(
    (p) =>
      p.kind === 'conversation' &&
      Date.parse(p.createdAt) >= quarterStart.getTime(),
  ).length

  const add = async () => {
    if (!draft.title.trim()) return
    await compass.addPrototype({
      kind: draft.kind,
      title: draft.title.trim(),
      person: draft.person.trim() || null,
      happenedOn: todayKey(),
      goingInQ: null,
      learned: null,
      nextStep: null,
      linkedPlan: draft.linkedPlan || null,
      status: 'planned',
    })
    setDraft({ kind: draft.kind, title: '', person: '', linkedPlan: '' })
  }

  const update = async (p: LdPrototype) => {
    if (p.status === 'done' && !(p.learned ?? '').trim()) {
      return
    }
    await compass.upsertPrototype(p)
  }

  return (
    <div className="pb-24">
      <div className="mb-4 rounded-[18px] border border-[#ECE7E2] bg-white p-4" style={{ boxShadow: cardShadow }}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[12px] font-semibold text-[#8A847E]">
            이번 분기 대화 {quarterConvos}건
          </p>
          <label className="flex items-center gap-1 text-[11px] text-[#8A847E]">
            목표
            <input
              type="number"
              min={1}
              max={20}
              value={goal}
              onChange={(e) => setGoal(Number(e.target.value) || 3)}
              className="w-12 rounded border border-[#ECE7E2] px-1 py-0.5 text-center"
            />
          </label>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#FAF8F6]">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, (quarterConvos / goal) * 100)}%`,
              background: COMPASS.accent,
            }}
          />
        </div>
      </div>

      <div className="mb-4 inline-flex rounded-full bg-[#FAF8F6] p-1">
        {(
          [
            ['conversation', '대화'],
            ['experience', '경험'],
            ['all', '전체'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setSeg(k)}
            className="rounded-full px-4 py-1.5 text-[13px] font-semibold"
            style={
              seg === k
                ? { background: COMPASS.accent, color: '#fff' }
                : { color: '#8A847E' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div
        className="mb-4 rounded-[18px] border border-[#ECE7E2] bg-white p-4"
        style={{ boxShadow: cardShadow }}
      >
        <div className="flex flex-wrap gap-2">
          <select
            value={draft.kind}
            onChange={(e) =>
              setDraft((d) => ({ ...d, kind: e.target.value as PrototypeKind }))
            }
            className="rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-2 py-2 text-[12px]"
          >
            <option value="conversation">대화</option>
            <option value="experience">경험</option>
          </select>
          <input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="제목"
            className="min-w-[8rem] flex-1 rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2 text-[13px]"
          />
          <input
            value={draft.person}
            onChange={(e) => setDraft((d) => ({ ...d, person: e.target.value }))}
            placeholder="상대/장소"
            className="w-28 rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2 text-[13px]"
          />
          <button
            type="button"
            onClick={() => void add()}
            className="rounded-full px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: COMPASS.accent }}
          >
            추가
          </button>
        </div>
      </div>

      <ul className="space-y-3">
        {list.map((p) => {
          const open = openId === p.id
          const statusLabel =
            p.status === 'planned' ? '예정' : p.status === 'done' ? '완료' : '접음'
          return (
            <li
              key={p.id}
              className="rounded-[18px] border border-[#ECE7E2] bg-white"
              style={{ boxShadow: cardShadow }}
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
                onClick={() => setOpenId(open ? null : p.id)}
              >
                {p.kind === 'conversation' ? (
                  <MessageCircle size={18} style={{ color: COMPASS.accent }} />
                ) : (
                  <Sparkles size={18} style={{ color: COMPASS.accent }} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{p.title}</p>
                  <p className="text-[12px] text-[#8A847E]">
                    {[p.person, p.happenedOn].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: COMPASS.soft, color: COMPASS.ink }}
                >
                  {statusLabel}
                </span>
              </button>
              {open && (
                <div className="space-y-2 border-t border-[#ECE7E2] px-4 py-3">
                  {(
                    [
                      ['goingInQ', '들어가기 전 궁금했던 것'],
                      ['learned', '알게 된 것'],
                      ['nextStep', '그래서 다음은'],
                    ] as const
                  ).map(([field, label]) => (
                    <label key={field} className="block">
                      <span className="text-[11px] text-[#8A847E]">{label}</span>
                      <textarea
                        rows={2}
                        value={p[field] ?? ''}
                        onChange={(e) =>
                          void update({ ...p, [field]: e.target.value })
                        }
                        className="mt-1 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2 text-[13px]"
                      />
                    </label>
                  ))}
                  {p.status === 'done' && !(p.learned ?? '').trim() && (
                    <p className="text-[12px] text-[#E0574A]">
                      여기가 이 대화의 전부예요.
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
                      style={{ background: COMPASS.accent }}
                      onClick={() => {
                        if (!(p.learned ?? '').trim()) {
                          void update({ ...p, status: 'done' })
                          return
                        }
                        void update({ ...p, status: 'done' })
                      }}
                    >
                      완료
                    </button>
                    <button
                      type="button"
                      className="text-[12px] text-[#8A847E]"
                      onClick={() => void update({ ...p, status: 'dropped' })}
                    >
                      접기
                    </button>
                    <button
                      type="button"
                      className="ml-auto text-[12px] text-[#E0574A]"
                      onClick={() => void compass.deletePrototype(p.id)}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
