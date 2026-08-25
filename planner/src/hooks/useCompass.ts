import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addDays,
  emptyDataForExercise,
  EXERCISE_META,
  newId,
  normalizeDashboardData,
  todayKey,
  type AiReportType,
  type DashboardData,
  type ExerciseKey,
  type LdAiReport,
  type LdAnswer,
  type LdJournalEntry,
  type LdPrototype,
  type LdQuestion,
  type LdSnapshot,
} from '../types/compass'
import {
  deleteJournalCloud,
  deletePrototypeCloud,
  deleteQuestionCloud,
  fetchCompassCloud,
  invokeCompassAnalyze,
  upsertAiReportCloud,
  upsertAnswerCloud,
  upsertJournalCloud,
  upsertPrototypeCloud,
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

type PersistSlice = {
  snapshots: LdSnapshot[]
  questions: LdQuestion[]
  answers: LdAnswer[]
  journalEntries: LdJournalEntry[]
  prototypes: LdPrototype[]
  aiReports: LdAiReport[]
}

export function useCompass() {
  const { user } = useAuth()
  const userId = user?.id ?? 'local'
  const [snapshots, setSnapshots] = useState<LdSnapshot[]>([])
  const [questions, setQuestions] = useState<LdQuestion[]>([])
  const [answers, setAnswers] = useState<LdAnswer[]>([])
  const [journalEntries, setJournalEntries] = useState<LdJournalEntry[]>([])
  const [prototypes, setPrototypes] = useState<LdPrototype[]>([])
  const [aiReports, setAiReports] = useState<LdAiReport[]>([])
  const [loading, setLoading] = useState(true)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const hydrated = useRef(false)

  const sliceRef = useRef<PersistSlice>({
    snapshots: [],
    questions: [],
    answers: [],
    journalEntries: [],
    prototypes: [],
    aiReports: [],
  })
  sliceRef.current = {
    snapshots,
    questions,
    answers,
    journalEntries,
    prototypes,
    aiReports,
  }

  const persist = useCallback(
    async (next: PersistSlice) => {
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
        let journals = local.journalEntries
        let protos = local.prototypes
        let reports = local.aiReports

        if (isSupabaseConfigured && user?.id) {
          try {
            const remote = await fetchCompassCloud(user.id)
            if (remote) {
              snaps = mergeById(snaps, remote.snapshots)
              qs = mergeById(qs, remote.questions)
              ans = mergeById(ans, remote.answers)
              journals = mergeById(journals, remote.journalEntries)
              protos = mergeById(protos, remote.prototypes)
              reports = mergeById(reports, remote.aiReports)
            }
          } catch {
            /* keep local */
          }
        }

        if (!cancelled) {
          setSnapshots(snaps)
          setQuestions(qs)
          setAnswers(ans)
          setJournalEntries(journals)
          setPrototypes(protos)
          setAiReports(reports)
          hydrated.current = true
          await saveCompassLocal(userId, {
            snapshots: snaps,
            questions: qs,
            answers: ans,
            journalEntries: journals,
            prototypes: protos,
            aiReports: reports,
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
        const slice = { ...sliceRef.current, snapshots: next }
        void persist(slice)
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
    [persist, user?.id],
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
        data: data ?? emptyDataForExercise(key),
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

  /** Allows updating a complete snapshot (e.g. filling in skipped Odyssey present). */
  const updateSnapshotData = useCallback(
    async (snapshotId: string, data: Record<string, unknown>) => {
      const snap = snapshots.find((s) => s.id === snapshotId)
      if (!snap) return
      const next: LdSnapshot = {
        ...snap,
        data,
        updatedAt: new Date().toISOString(),
      }
      if (snap.status !== 'complete') {
        saveDraftLocal(`${snap.exerciseKey}:${snap.id}`, data)
      }
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
    async (input: { body: string; cadenceDays: number; color: string }) => {
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
        void persist({ ...sliceRef.current, questions: next })
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
    [persist, user?.id, userId],
  )

  const updateQuestion = useCallback(
    async (question: LdQuestion) => {
      setQuestions((prev) => {
        const next = prev.map((q) => (q.id === question.id ? question : q))
        void persist({ ...sliceRef.current, questions: next })
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
    [persist, user?.id],
  )

  const deleteQuestion = useCallback(
    async (questionId: string) => {
      setQuestions((prev) => {
        const next = prev.filter((q) => q.id !== questionId)
        void persist({
          ...sliceRef.current,
          questions: next,
          answers: sliceRef.current.answers.filter((a) => a.questionId !== questionId),
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
    [persist, user?.id],
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
          void persist({
            ...sliceRef.current,
            questions: nextQs,
            answers: nextA,
          })
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
    [persist, questions, user?.id, userId],
  )

  const upsertJournalEntry = useCallback(
    async (entry: LdJournalEntry) => {
      setJournalEntries((prev) => {
        const next = prev.some((e) => e.id === entry.id)
          ? prev.map((e) => (e.id === entry.id ? entry : e))
          : [...prev, entry]
        void persist({ ...sliceRef.current, journalEntries: next })
        return next
      })
      setLastSavedAt(new Date())
      if (isSupabaseConfigured && user?.id) {
        try {
          await upsertJournalCloud(entry)
        } catch {
          setSaveError('저장 실패. 네트워크 확인하고 다시 눌러주세요.')
        }
      }
    },
    [persist, user?.id],
  )

  const addJournalEntry = useCallback(
    async (input: Omit<LdJournalEntry, 'id' | 'userId' | 'createdAt'>) => {
      const entry: LdJournalEntry = {
        ...input,
        id: newId(),
        userId,
        createdAt: new Date().toISOString(),
      }
      await upsertJournalEntry(entry)
      return entry
    },
    [upsertJournalEntry, userId],
  )

  const deleteJournalEntry = useCallback(
    async (id: string) => {
      setJournalEntries((prev) => {
        const next = prev.filter((e) => e.id !== id)
        void persist({ ...sliceRef.current, journalEntries: next })
        return next
      })
      if (isSupabaseConfigured && user?.id) {
        try {
          await deleteJournalCloud(id)
        } catch {
          setSaveError('저장 실패. 네트워크 확인하고 다시 눌러주세요.')
        }
      }
    },
    [persist, user?.id],
  )

  const upsertPrototype = useCallback(
    async (proto: LdPrototype) => {
      setPrototypes((prev) => {
        const next = prev.some((p) => p.id === proto.id)
          ? prev.map((p) => (p.id === proto.id ? proto : p))
          : [...prev, proto]
        void persist({ ...sliceRef.current, prototypes: next })
        return next
      })
      setLastSavedAt(new Date())
      if (isSupabaseConfigured && user?.id) {
        try {
          await upsertPrototypeCloud(proto)
        } catch {
          setSaveError('저장 실패. 네트워크 확인하고 다시 눌러주세요.')
        }
      }
    },
    [persist, user?.id],
  )

  const addPrototype = useCallback(
    async (input: Omit<LdPrototype, 'id' | 'userId' | 'createdAt'>) => {
      const proto: LdPrototype = {
        ...input,
        id: newId(),
        userId,
        createdAt: new Date().toISOString(),
      }
      await upsertPrototype(proto)
      return proto
    },
    [upsertPrototype, userId],
  )

  const deletePrototype = useCallback(
    async (id: string) => {
      setPrototypes((prev) => {
        const next = prev.filter((p) => p.id !== id)
        void persist({ ...sliceRef.current, prototypes: next })
        return next
      })
      if (isSupabaseConfigured && user?.id) {
        try {
          await deletePrototypeCloud(id)
        } catch {
          setSaveError('저장 실패. 네트워크 확인하고 다시 눌러주세요.')
        }
      }
    },
    [persist, user?.id],
  )

  const saveAiReport = useCallback(
    async (report: LdAiReport) => {
      setAiReports((prev) => {
        const next = prev.some((r) => r.id === report.id)
          ? prev.map((r) => (r.id === report.id ? report : r))
          : [report, ...prev]
        void persist({ ...sliceRef.current, aiReports: next })
        return next
      })
      if (isSupabaseConfigured && user?.id) {
        try {
          await upsertAiReportCloud(report)
        } catch {
          /* local ok */
        }
      }
    },
    [persist, user?.id],
  )

  const requestAiReport = useCallback(
    async (input: {
      reportType: AiReportType
      inputHash: string
      inputRefs: Record<string, unknown>
      payload: unknown
    }) => {
      const cached = aiReports.find((r) => r.inputHash === input.inputHash)
      if (cached) return cached

      if (isSupabaseConfigured && user?.id) {
        try {
          const { report } = await invokeCompassAnalyze(input)
          await saveAiReport(report)
          return report
        } catch {
          /* fall through to local stub */
        }
      }

      const report: LdAiReport = {
        id: newId(),
        userId,
        reportType: input.reportType,
        inputHash: input.inputHash,
        inputRefs: input.inputRefs,
        model: 'local-stub',
        createdAt: new Date().toISOString(),
        output: {
          report_type: input.reportType,
          headline: '기록을 읽었다. Edge Function이 연결되면 더 정확한 리포트가 온다.',
          observations: [
            {
              text: '지금은 로컬 스텁이다. Gemini Edge Function을 배포하면 같은 입력으로 캐시된 리포트가 온다.',
              evidence: ['로컬 모드'],
              source: 'system',
            },
          ],
          pathways:
            input.reportType === 'pathway'
              ? [
                  {
                    name: '작은 테스트부터',
                    why_it_fits: ['기록이 쌓이고 있다'],
                    friction: ['아직 AI가 연결되지 않았다'],
                    smallest_test: '이번 주 굿타임 저널 3줄 쓰기',
                    confidence: 'low',
                  },
                ]
              : undefined,
          tension: null,
          unknowns: ['Gemini Edge Function 미배포'],
          next_question: '지금 기록이 말해 주는 건 무엇인가?',
        },
      }
      await saveAiReport(report)
      return report
    },
    [aiReports, saveAiReport, user?.id, userId],
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

    for (const meta of EXERCISE_META.filter((m) => m.cadenceDays)) {
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
    for (const j of journalEntries) set.add(j.entryDate)
    return set
  }, [answers, journalEntries, snapshots])

  const badgeCount = dueQuestions.length

  const getDashboardDraftData = useCallback((snapshot: LdSnapshot): DashboardData => {
    const fromLs = loadDraftLocal<DashboardData>(`${snapshot.exerciseKey}:${snapshot.id}`)
    if (fromLs) return normalizeDashboardData(fromLs)
    return normalizeDashboardData(snapshot.data)
  }, [])

  const getDraftData = useCallback(<T,>(snapshot: LdSnapshot, fallback: T): T => {
    const fromLs = loadDraftLocal<T>(`${snapshot.exerciseKey}:${snapshot.id}`)
    if (fromLs) return fromLs
    if (snapshot.data && Object.keys(snapshot.data).length > 0) {
      return snapshot.data as unknown as T
    }
    return fallback
  }, [])

  return {
    loading,
    snapshots,
    questions,
    answers,
    journalEntries,
    prototypes,
    aiReports,
    saveError,
    lastSavedAt,
    snapshotsFor,
    completeSnapshotsFor,
    draftFor,
    createDraft,
    updateDraftData,
    updateSnapshotData,
    completeSnapshot,
    dueQuestions,
    waitingQuestions,
    answersFor,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    submitAnswer,
    upsertJournalEntry,
    addJournalEntry,
    deleteJournalEntry,
    upsertPrototype,
    addPrototype,
    deletePrototype,
    saveAiReport,
    requestAiReport,
    revisitItems,
    activityDates,
    badgeCount,
    getDashboardDraftData,
    getDraftData,
  }
}

export type CompassActions = ReturnType<typeof useCompass>
