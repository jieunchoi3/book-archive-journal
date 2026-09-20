import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MailboxLetter, MailboxPrompt, MailboxStore } from '../types/mailbox'
import { MAILBOX_ENVELOPE_COLORS } from '../types/mailbox'
import { loadMailbox, loadMailboxLocal, persistMailbox, saveMailboxLocal } from '../lib/mailboxStorage'
import { addDays, todayKey } from '../types/compass'
import { generateId } from '../lib/weekUtils'
import { useAuth } from './useAuth'

export interface MailboxActions {
  loading: boolean
  syncError: string | null
  prompts: MailboxPrompt[]
  letters: MailboxLetter[]
  unreadCount: number
  duePrompts: MailboxPrompt[]
  dueLetters: MailboxLetter[]
  waitingLetters: MailboxLetter[]
  waitingPrompts: MailboxPrompt[]
  archiveLetters: MailboxLetter[]
  answersForPrompt: (promptId: string) => MailboxLetter[]
  refresh: () => Promise<void>
  sendScheduledLetter: (input: {
    body: string
    deliverInDays: number
    envelopeColor?: string
  }) => Promise<void>
  createRepeatingQuestion: (input: {
    body: string
    cadenceDays: number
    firstAnswer: string
    feeling?: number | null
    envelopeColor?: string
  }) => Promise<void>
  submitPromptAnswer: (promptId: string, body: string, feeling?: number | null) => Promise<void>
  openScheduledLetter: (letterId: string) => Promise<void>
  deactivatePrompt: (promptId: string) => Promise<void>
  randomSurpriseLetter: () => MailboxLetter | null
}

export function useMailbox(): MailboxActions {
  const { user } = useAuth()
  const userId = user.id
  const [store, setStore] = useState<MailboxStore>(() => loadMailboxLocal(userId))
  const [loading, setLoading] = useState(true)
  const [syncError, setSyncError] = useState<string | null>(null)
  const storeRef = useRef(store)

  useEffect(() => {
    storeRef.current = store
  }, [store])

  const applyStore = useCallback(
    (next: MailboxStore, pushCloud = true) => {
      storeRef.current = next
      setStore(next)
      saveMailboxLocal(userId, next)
      if (pushCloud && userId) {
        void persistMailbox(userId, next).catch((e) => {
          console.error('[mailbox] persist failed', e)
          setSyncError(e instanceof Error ? e.message : 'Mailbox sync failed')
        })
      }
    },
    [userId],
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const merged = await loadMailbox(userId)
      applyStore(merged, false)
      setSyncError(null)
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Could not load mailbox')
    } finally {
      setLoading(false)
    }
  }, [applyStore, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [refresh])

  const today = todayKey()

  const duePrompts = useMemo(
    () =>
      store.prompts
        .filter((p) => p.isActive && p.nextDueOn <= today)
        .sort((a, b) => a.nextDueOn.localeCompare(b.nextDueOn)),
    [store.prompts, today],
  )

  const dueLetters = useMemo(
    () =>
      store.letters
        .filter(
          (l) =>
            l.kind === 'scheduled_letter' && l.deliverOn <= today && !l.openedAt,
        )
        .sort((a, b) => a.deliverOn.localeCompare(b.deliverOn)),
    [store.letters, today],
  )

  const waitingLetters = useMemo(
    () =>
      store.letters
        .filter((l) => l.kind === 'scheduled_letter' && l.deliverOn > today && !l.openedAt)
        .sort((a, b) => a.deliverOn.localeCompare(b.deliverOn)),
    [store.letters, today],
  )

  const waitingPrompts = useMemo(
    () =>
      store.prompts
        .filter((p) => p.isActive && p.nextDueOn > today)
        .sort((a, b) => a.nextDueOn.localeCompare(b.nextDueOn)),
    [store.prompts, today],
  )

  const archiveLetters = useMemo(
    () =>
      store.letters
        .filter(
          (l) =>
            l.openedAt ||
            l.kind === 'prompt_answer' ||
            (l.kind === 'scheduled_letter' && l.deliverOn <= today && l.openedAt),
        )
        .sort((a, b) => b.writtenOn.localeCompare(a.writtenOn)),
    [store.letters],
  )

  const unreadCount = duePrompts.length + dueLetters.length

  const answersForPrompt = useCallback(
    (promptId: string) =>
      store.letters
        .filter((l) => l.kind === 'prompt_answer' && l.promptId === promptId)
        .sort((a, b) => b.writtenOn.localeCompare(a.writtenOn)),
    [store.letters],
  )

  const sendScheduledLetter = useCallback(
    async (input: { body: string; deliverInDays: number; envelopeColor?: string }) => {
      const trimmed = input.body.trim()
      if (!trimmed) return
      const writtenOn = todayKey()
      const deliverOn = addDays(writtenOn, Math.max(1, input.deliverInDays))
      const now = new Date().toISOString()
      const letter: MailboxLetter = {
        id: generateId(),
        userId,
        kind: 'scheduled_letter',
        promptId: null,
        body: trimmed,
        writtenOn,
        deliverOn,
        openedAt: null,
        feeling: null,
        createdAt: now,
      }
      applyStore({ ...storeRef.current, letters: [...storeRef.current.letters, letter] })
    },
    [applyStore, userId],
  )

  const createRepeatingQuestion = useCallback(
    async (input: {
      body: string
      cadenceDays: number
      firstAnswer: string
      feeling?: number | null
      envelopeColor?: string
    }) => {
      const question = input.body.trim()
      const answer = input.firstAnswer.trim()
      if (!question || !answer) return
      const now = new Date().toISOString()
      const writtenOn = todayKey()
      const promptId = generateId()
      const cadence = Math.max(1, input.cadenceDays)
      const prompt: MailboxPrompt = {
        id: promptId,
        userId,
        body: question,
        cadenceDays: cadence,
        nextDueOn: addDays(writtenOn, cadence),
        isActive: true,
        envelopeColor: input.envelopeColor ?? MAILBOX_ENVELOPE_COLORS[0],
        createdAt: now,
      }
      const letter: MailboxLetter = {
        id: generateId(),
        userId,
        kind: 'prompt_answer',
        promptId,
        body: answer,
        writtenOn,
        deliverOn: writtenOn,
        openedAt: now,
        feeling: input.feeling ?? null,
        createdAt: now,
      }
      applyStore({
        prompts: [...storeRef.current.prompts, prompt],
        letters: [...storeRef.current.letters, letter],
      })
    },
    [applyStore, userId],
  )

  const submitPromptAnswer = useCallback(
    async (promptId: string, body: string, feeling?: number | null) => {
      const trimmed = body.trim()
      if (!trimmed) return
      const prompt = storeRef.current.prompts.find((p) => p.id === promptId)
      if (!prompt) return
      const now = new Date().toISOString()
      const writtenOn = todayKey()
      const letter: MailboxLetter = {
        id: generateId(),
        userId,
        kind: 'prompt_answer',
        promptId,
        body: trimmed,
        writtenOn,
        deliverOn: writtenOn,
        openedAt: now,
        feeling: feeling ?? null,
        createdAt: now,
      }
      const nextPrompt: MailboxPrompt = {
        ...prompt,
        nextDueOn: addDays(writtenOn, prompt.cadenceDays),
      }
      applyStore({
        prompts: storeRef.current.prompts.map((p) => (p.id === promptId ? nextPrompt : p)),
        letters: [...storeRef.current.letters, letter],
      })
    },
    [applyStore, userId],
  )

  const openScheduledLetter = useCallback(
    async (letterId: string) => {
      const letter = storeRef.current.letters.find((l) => l.id === letterId)
      if (!letter || letter.openedAt) return
      if (letter.deliverOn > todayKey()) return
      const openedAt = new Date().toISOString()
      applyStore({
        ...storeRef.current,
        letters: storeRef.current.letters.map((l) =>
          l.id === letterId ? { ...l, openedAt } : l,
        ),
      })
    },
    [applyStore],
  )

  const deactivatePrompt = useCallback(
    async (promptId: string) => {
      applyStore({
        ...storeRef.current,
        prompts: storeRef.current.prompts.map((p) =>
          p.id === promptId ? { ...p, isActive: false } : p,
        ),
      })
    },
    [applyStore],
  )

  const randomSurpriseLetter = useCallback((): MailboxLetter | null => {
    const pool = storeRef.current.letters.filter(
      (l) => l.openedAt || l.kind === 'prompt_answer',
    )
    if (!pool.length) return null
    return pool[Math.floor(Math.random() * pool.length)] ?? null
  }, [])

  return {
    loading,
    syncError,
    prompts: store.prompts,
    letters: store.letters,
    unreadCount,
    duePrompts,
    dueLetters,
    waitingLetters,
    waitingPrompts,
    archiveLetters,
    answersForPrompt,
    refresh,
    sendScheduledLetter,
    createRepeatingQuestion,
    submitPromptAnswer,
    openScheduledLetter,
    deactivatePrompt,
    randomSurpriseLetter,
  }
}
