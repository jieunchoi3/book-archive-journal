import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addDays,
  emptyDashboardData,
  EXERCISE_META,
  newId,
  todayKey,
  type DashboardData,
  type ExerciseKey,
  type LdAnswer,
  type LdQuestion,
  type LdSnapshot,
} from '../types/compass'
import {
  deleteQuestionCloud,
  fetchCompassCloud,
  upsertAnswerCloud,
  upsertQuestionCloud,
  upsertSnapshotCloud,
} from '../lib/compassCloud'
import {
  clearDraftLocal,
  loadCompassLocal,
  loadDraftLocal,
  saveCompassLocal,
  saveDraftLocal,
} from '../lib/compassStorage'
import { isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from './useAuth'

function mergeById<T extends { id: string; updatedAt?: string; createdAt?: string }>(
  local: T[],
  remote: T[],
): T[] {
  const map = new Map<string, T>()
  for (const item of local) map.set(item.id, item)
  for (const item of remote) {
    const prev = map.get(item.id)
    if (!prev) {
      map.set(item.id, item)
      continue
    }
    const prevTs = prev.updatedAt ?? prev.createdAt ?? ''
    const nextTs = item.updatedAt ?? item.createdAt ?? ''
    if (nextTs >= prevTs) map.set(item.id, item)
  }
  return [...map.values()]
}

export function useCompass() {
  const { user } = useAuth()
  const userId = user?.id ?? 'local'
  const [snapshots, setSnapshots] = useState<LdSnapshot[]>([])
  const [questions, setQuestions] = useState<LdQuestion[]>([])
  const [answers, setAnswers] = useState<LdAnswer[]>([])
  const [loading, setLoading] = useState(true)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const hydrated = useRef(false)

  const persist = useCallback(
    async (next: {
      snapshots: LdSnapshot[]
      questions: LdQuestion[]
      answers: LdAnswer[]
    }) => {
      await saveCompassLocal(userId, {
        ...next,
        updatedAt: new Date().toISOString(),
      })
    },
    [userId],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const local = await loadCompassLocal(userId)
        let snaps = local.snapshots
        let qs = local.questions
        let ans = local.answers

        if (isSupabaseConfigured && user?.id) {
          try {
            const remote = await fetchCompassCloud(user.id)
            if (remote) {
              snaps = mergeById(snaps, remote.snapshots)
              qs = mergeById(qs, remote.questions)
              ans = mergeById(ans, remote.answers)
            }
          } catch {
            /* keep local */
          }
        }

        if (!cancelled) {
          setSnapshots(snaps)
          setQuestions(qs)
          setAnswers(ans)
          hydrated.current = true
          await saveCompassLocal(userId, {
            snapshots: snaps,
            questions: qs,
            answers: ans,
            updatedAt: new Date().toISOString(),
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, user?.id])

  const snapshotsFor = useCallback(
    (key: ExerciseKey) =>
      snapshots
        .filter((s) => s.exerciseKey === key)
        .sort((a, b) => a.takenAt.localeCompare(b.takenAt) || a.createdAt.localeCompare(b.createdAt)),
    [snapshots],
  )

  const completeSnapshotsFor = useCallback(
    (key: ExerciseKey) => snapshotsFor(key).filter((s) => s.status === 'complete'),
    [snapshotsFor],
  )

  const draftFor = useCallback(
    (key: ExerciseKey) =>
      snapshotsFor(key)
        .filter((s) => s.status === 'draft')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null,
    [snapshotsFor],
  )

  const upsertSnapshot = useCallback(
    async (snapshot: LdSnapshot, opts?: { skipCloud?: boolean }) => {
      setSnapshots((prev) => {
        const next = prev.some((s) => s.id === snapshot.id)
          ? prev.map((s) => (s.id === snapshot.id ? snapshot : s))
          : [...prev, snapshot]
        void persist({ snapshots: next, questions, answers })
        return next
      })
      setLastSavedAt(new Date())
      setSaveError(null)
      if (!opts?.skipCloud && isSupabaseConfigured && user?.id) {
        try {
          await upsertSnapshotCloud(snapshot)
        } catch {
          setSaveError('저장 실패. 네트워크 확인하고 다시 눌러주세요.')
        }
      }
    },
    [answers, persist, questions, user?.id],
  )

  const createDraft = useCallback(
    async (key: ExerciseKey, data?: Record<string, unknown>, forceNew = false) => {
      if (!forceNew) {
        const existing = draftFor(key)
        if (existing) return existing
      }
      const now = new Date().toISOString()
      const snapshot: LdSnapshot = {
        id: newId(),
        userId,
        exerciseKey: key,
        takenAt: todayKey(),
        label: null,
        status: 'draft',
        data:
          data ??
          (key === 'dashboard'
            ? (emptyDashboardData() as unknown as Record<string, unknown>)
            : {}),
        createdAt: now,
        updatedAt: now,
      }
      await upsertSnapshot(snapshot)
      return snapshot
    },
    [draftFor, upsertSnapshot, userId],
  )

  const updateDraftData = useCallback(
    async (snapshotId: string, data: Record<string, unknown>) => {
      const snap = snapshots.find((s) => s.id === snapshotId)
      if (!snap) return
      if (snap.status === 'complete') {
        throw new Error('COMPLETE_LOCKED')
      }
      const next: LdSnapshot = {
        ...snap,
        data,
        updatedAt: new Date().toISOString(),
      }
      saveDraftLocal(`${snap.exerciseKey}:${snap.id}`, data)
      await upsertSnapshot(next)
    },
    [snapshots, upsertSnapshot],
  )

  const completeSnapshot = useCallback(
    async (snapshotId: string, label?: string) => {
      const snap = snapshots.find((s) => s.id === snapshotId)
      if (!snap || snap.status === 'complete') return
      const completes = completeSnapshotsFor(snap.exerciseKey)
      const ordinal = completes.length + 1
      const next: LdSnapshot = {
        ...snap,
        status: 'complete',
        takenAt: todayKey(),
        label: label ?? `${ordinal}차`,
        updatedAt: new Date().toISOString(),
      }
      clearDraftLocal(`${snap.exerciseKey}:${snap.id}`)
      await upsertSnapshot(next)
    },
    [completeSnapshotsFor, snapshots, upsertSnapshot],
  )

  const dueQuestions = useMemo(() => {
    const today = todayKey()
    return questions
      .filter((q) => q.isActive && q.nextDueOn <= today)
      .sort((a, b) => a.nextDueOn.localeCompare(b.nextDueOn))
  }, [questions])

  const waitingQuestions = useMemo(() => {
    const today = todayKey()
    return questions
      .filter((q) => q.isActive && q.nextDueOn > today)
      .sort((a, b) => a.nextDueOn.localeCompare(b.nextDueOn))
  }, [questions])

  const answersFor = useCallback(
    (questionId: string) =>
      answers
        .filter((a) => a.questionId === questionId)
        .sort((a, b) => b.answeredOn.localeCompare(a.answeredOn) || b.createdAt.localeCompare(a.createdAt)),
    [answers],
  )

  const createQuestion = useCallback(
    async (input: {
      body: string
      cadenceDays: number
      color: string
    }) => {
      const now = new Date().toISOString()
      const q: LdQuestion = {
        id: newId(),
        userId,
        body: input.body.trim(),
        cadenceDays: input.cadenceDays,
        nextDueOn: todayKey(),
        isActive: true,
        color: input.color,
        createdAt: now,
      }
      setQuestions((prev) => {
        const next = [...prev, q]
        void persist({ snapshots, questions: next, answers })
        return next
      })
      if (isSupabaseConfigured && user?.id) {
        try {
          await upsertQuestionCloud(q)
        } catch {
          setSaveError('저장 실패. 네트워크 확인하고 다시 눌러주세요.')
        }
      }
      return q
    },
    [answers, persist, snapshots, user?.id, userId],
  )

  const updateQuestion = useCallback(
    async (question: LdQuestion) => {
      setQuestions((prev) => {
        const next = prev.map((q) => (q.id === question.id ? question : q))
        void persist({ snapshots, questions: next, answers })
        return next
      })
      if (isSupabaseConfigured && user?.id) {
        try {
          await upsertQuestionCloud(question)
        } catch {
          setSaveError('저장 실패. 네트워크 확인하고 다시 눌러주세요.')
        }
      }
    },
    [answers, persist, snapshots, user?.id],
  )

  const deleteQuestion = useCallback(
    async (questionId: string) => {
      setQuestions((prev) => {
        const next = prev.filter((q) => q.id !== questionId)
        void persist({
          snapshots,
          questions: next,
          answers: answers.filter((a) => a.questionId !== questionId),
        })
        return next
      })
      setAnswers((prev) => prev.filter((a) => a.questionId !== questionId))
      if (isSupabaseConfigured && user?.id) {
        try {
          await deleteQuestionCloud(questionId)
        } catch {
          setSaveError('저장 실패. 네트워크 확인하고 다시 눌러주세요.')
        }
      }
    },
    [answers, persist, snapshots, user?.id],
  )

  const submitAnswer = useCallback(
    async (questionId: string, body: string, feeling: number | null) => {
      const q = questions.find((x) => x.id === questionId)
      if (!q) throw new Error('QUESTION_MISSING')
      const now = new Date().toISOString()
      const answeredOn = todayKey()
      const answer: LdAnswer = {
        id: newId(),
        questionId,
        userId,
        answeredOn,
        body: body.trim(),
        feeling,
        createdAt: now,
      }
      const nextQ: LdQuestion = {
        ...q,
        nextDueOn: addDays(answeredOn, q.cadenceDays),
      }
      setAnswers((prev) => {
        const nextA = [...prev, answer]
        setQuestions((prevQ) => {
          const nextQs = prevQ.map((x) => (x.id === questionId ? nextQ : x))
          void persist({ snapshots, questions: nextQs, answers: nextA })
          return nextQs
        })
        return nextA
      })
      if (isSupabaseConfigured && user?.id) {
        try {
          await upsertAnswerCloud(answer)
          await upsertQuestionCloud(nextQ)
        } catch {
          setSaveError('저장 실패. 네트워크 확인하고 다시 눌러주세요.')
        }
      }
      return answer
    },
    [persist, questions, snapshots, user?.id, userId],
  )

  const revisitItems = useMemo(() => {
    const items: {
      id: string
      kind: 'question' | 'exercise'
      title: string
      subtitle: string
      action: 'open-ask' | 'open-exercise'
      exerciseKey?: ExerciseKey
      questionId?: string
    }[] = []

    for (const q of dueQuestions) {
      const count = answersFor(q.id).length
      items.push({
        id: `q-${q.id}`,
        kind: 'question',
        title: q.body,
        subtitle:
          count > 0
            ? `${Math.round(q.cadenceDays / 30)}개월 전에 쓴 질문 · 지난 답 ${count}개`
            : '오늘 열린 질문',
        action: 'open-ask',
        questionId: q.id,
      })
    }

    for (const meta of EXERCISE_META.filter((m) => m.phase === 1 && m.cadenceDays)) {
      const completes = completeSnapshotsFor(meta.key)
      if (completes.length === 0) continue
      const last = completes[completes.length - 1]
      const days = Math.max(0, Math.round((Date.now() - Date.parse(last.takenAt)) / 86400000))
      if (days >= (meta.cadenceDays ?? 0)) {
        items.push({
          id: `e-${meta.key}`,
          kind: 'exercise',
          title: meta.name,
          subtitle: `마지막 기록 ${days}일 전`,
          action: 'open-exercise',
          exerciseKey: meta.key,
        })
      }
    }

    return items
  }, [answersFor, completeSnapshotsFor, dueQuestions])

  const activityDates = useMemo(() => {
    const set = new Set<string>()
    for (const s of snapshots.filter((x) => x.status === 'complete')) set.add(s.takenAt)
    for (const a of answers) set.add(a.answeredOn)
    return set
  }, [answers, snapshots])

  const badgeCount = dueQuestions.length

  const getDashboardDraftData = useCallback(
    (snapshot: LdSnapshot): DashboardData => {
      const fromLs = loadDraftLocal<DashboardData>(`${snapshot.exerciseKey}:${snapshot.id}`)
      if (fromLs) return fromLs
      const d = snapshot.data as unknown as DashboardData
      if (d?.gauges) return d
      return emptyDashboardData()
    },
    [],
  )

  return {
    loading,
    snapshots,
    questions,
    answers,
    saveError,
    lastSavedAt,
    snapshotsFor,
    completeSnapshotsFor,
    draftFor,
    createDraft,
    updateDraftData,
    completeSnapshot,
    dueQuestions,
    waitingQuestions,
    answersFor,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    submitAnswer,
    revisitItems,
    activityDates,
    badgeCount,
    getDashboardDraftData,
  }
}

export type CompassActions = ReturnType<typeof useCompass>
