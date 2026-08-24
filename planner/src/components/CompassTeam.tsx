import { useCallback, useEffect, useState } from 'react'
import {
  COMPASS,
  emptyTeamData,
  newId,
  todayKey,
  type TeamData,
  type TeamRole,
} from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import {
  ExerciseChrome,
  useDebouncedDraftSave,
  useExerciseSnapshot,
  cardShadow,
} from './CompassExerciseShell'

interface CompassTeamProps {
  compass: CompassActions
  snapshotId?: string
  onNavigateSnapshot: (id: string | undefined) => void
  onCompare?: (ids: [string, string]) => void
  onRequestSnapshotAi?: (snapshotId: string) => void
}

const ROLES: TeamRole[] = ['멘토', '응원', '같이 하는 사람', '현실 검증']

export function CompassTeam({
  compass,
  snapshotId,
  onNavigateSnapshot,
  onCompare,
  onRequestSnapshotAi,
}: CompassTeamProps) {
  const { all, active, ensureDraft, readonly } = useExerciseSnapshot(
    compass,
    'team',
    snapshotId,
    onNavigateSnapshot,
  )
  const [data, setData] = useState<TeamData>(emptyTeamData())
  const [lockedMsg, setLockedMsg] = useState(false)

  useEffect(() => {
    if (!active) {
      setData(emptyTeamData())
      return
    }
    setData(compass.getDraftData(active, emptyTeamData()))
    setLockedMsg(false)
  }, [active, compass])

  const save = useCallback(
    async (id: string, next: TeamData) => {
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

  const quietDot = (last: string | null) => {
    if (!last) return true
    const days = Math.round((Date.now() - Date.parse(last)) / 86400000)
    return days > 90
  }

  return (
    <ExerciseChrome
      exerciseKey="team"
      compass={compass}
      all={all}
      active={active}
      onNavigateSnapshot={onNavigateSnapshot}
      onCompare={onCompare}
      onRequestSnapshotAi={onRequestSnapshotAi}
      onCreateNew={() => void ensureDraft(true)}
      savedAt={savedAt}
      error={error}
      help="멘토·응원·동료를 한곳에 모아 두어요."
      lockedMsg={lockedMsg}
      onComplete={() => active && void compass.completeSnapshot(active.id)}
    >
      {!readonly && (
        <button
          type="button"
          className="mb-4 rounded-full px-4 py-2 text-[13px] font-semibold text-white"
          style={{ background: COMPASS.accent }}
          onClick={() =>
            setData((d) => ({
              ...d,
              people: [
                ...d.people,
                {
                  id: newId(),
                  name: '',
                  relation: '',
                  roles: [],
                  lastContact: todayKey(),
                  note: '',
                  linkedPrototypeId: null,
                },
              ],
            }))
          }
        >
          + 사람 추가
        </button>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {data.people.map((p) => (
          <div
            key={p.id}
            className="relative rounded-[18px] border border-[#ECE7E2] bg-white p-4"
            style={{ boxShadow: cardShadow }}
          >
            {quietDot(p.lastContact) && (
              <span
                className="absolute right-3 top-3 h-2 w-2 rounded-full"
                style={{ background: COMPASS.line }}
                title="90일 넘게 연락 없음"
              />
            )}
            <input
              disabled={readonly}
              value={p.name}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  people: d.people.map((x) =>
                    x.id === p.id ? { ...x, name: e.target.value } : x,
                  ),
                }))
              }
              placeholder="이름"
              className="w-full text-[16px] font-semibold focus:outline-none"
            />
            <input
              disabled={readonly}
              value={p.relation}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  people: d.people.map((x) =>
                    x.id === p.id ? { ...x, relation: e.target.value } : x,
                  ),
                }))
              }
              placeholder="관계"
              className="mt-1 w-full text-[13px] text-[#8A847E] focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {ROLES.map((r) => {
                const on = p.roles.includes(r)
                return (
                  <button
                    key={r}
                    type="button"
                    disabled={readonly}
                    onClick={() => {
                      if (readonly) {
                        setLockedMsg(true)
                        return
                      }
                      setData((d) => ({
                        ...d,
                        people: d.people.map((x) =>
                          x.id === p.id
                            ? {
                                ...x,
                                roles: on
                                  ? x.roles.filter((y) => y !== r)
                                  : [...x.roles, r],
                              }
                            : x,
                        ),
                      }))
                    }}
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={
                      on
                        ? { background: COMPASS.soft, color: COMPASS.ink }
                        : { background: '#FAF8F6', color: '#B5AFA8' }
                    }
                  >
                    {r}
                  </button>
                )
              })}
            </div>
            <label className="mt-3 block text-[11px] text-[#8A847E]">
              마지막 연락일
              <input
                type="date"
                disabled={readonly}
                value={p.lastContact ?? ''}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    people: d.people.map((x) =>
                      x.id === p.id
                        ? { ...x, lastContact: e.target.value || null }
                        : x,
                    ),
                  }))
                }
                className="mt-1 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-2 py-1.5 text-[13px]"
              />
            </label>
            <textarea
              disabled={readonly}
              value={p.note}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  people: d.people.map((x) =>
                    x.id === p.id ? { ...x, note: e.target.value } : x,
                  ),
                }))
              }
              placeholder="메모"
              rows={2}
              className="mt-2 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-2 py-1.5 text-[13px]"
            />
            {compass.prototypes.filter((pr) => pr.kind === 'conversation').length >
              0 && (
              <select
                disabled={readonly}
                value={p.linkedPrototypeId ?? ''}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    people: d.people.map((x) =>
                      x.id === p.id
                        ? { ...x, linkedPrototypeId: e.target.value || null }
                        : x,
                    ),
                  }))
                }
                className="mt-2 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-2 py-1.5 text-[12px]"
              >
                <option value="">프로토타입 대화 링크</option>
                {compass.prototypes
                  .filter((pr) => pr.kind === 'conversation')
                  .map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.title}
                    </option>
                  ))}
              </select>
            )}
          </div>
        ))}
      </div>
    </ExerciseChrome>
  )
}
