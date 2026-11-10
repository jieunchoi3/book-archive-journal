import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  sendCloudDiaryCoachChat,
  type CoachChatMessage,
} from '../lib/cloudDiaryCoachClient'

const STORAGE_PREFIX = 'cloud-diary-coach-v1'

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`
}

function loadHistory(userId: string): CoachChatMessage[] {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as CoachChatMessage[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveHistory(userId: string, messages: CoachChatMessage[]) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(messages.slice(-40)))
  } catch {
    /* quota */
  }
}

export function CloudDiaryCoachPanel({
  userId,
  open,
  onClose,
}: {
  userId: string
  open: boolean
  onClose: () => void
}) {
  const [messages, setMessages] = useState<CoachChatMessage[]>(() => loadHistory(userId))
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [entryCount, setEntryCount] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages(loadHistory(userId))
  }, [userId])

  useEffect(() => {
    saveHistory(userId, messages)
  }, [userId, messages])

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [open, messages, loading])

  const send = useCallback(async () => {
    const text = draft.trim()
    if (!text || loading) return

    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) {
      setError('Sign in to use the diary coach.')
      return
    }

    let pending: CoachChatMessage[] = []
    setMessages((prev) => {
      pending = [...prev, { role: 'user', content: text }]
      return pending
    })
    setDraft('')
    setLoading(true)
    setError(null)

    try {
      const res = await sendCloudDiaryCoachChat(token, pending)
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply }])
      if (typeof res.entryCount === 'number') setEntryCount(res.entryCount)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the coach')
      setMessages((prev) => prev.slice(0, -1))
      setDraft(text)
    } finally {
      setLoading(false)
    }
  }, [draft, loading])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-end p-2 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/25"
        onClick={onClose}
        aria-label="Close coach"
      />
      <div className="relative flex h-full w-full max-w-md flex-col rounded-2xl border border-hairline bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-2 border-b border-hairline px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-[#007AFF]">
              <MessageCircle size={18} />
              <h2 className="text-[15px] font-semibold text-[#1C1C1E]">Diary coach</h2>
            </div>
            <p className="mt-0.5 text-[11px] text-muted">
              Reads your Cloud diary text each reply. Not sent to other users.
              {entryCount != null ? ` · ${entryCount} entries loaded` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-[#F2F2F7]"
            aria-label="Close coach"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {messages.length === 0 && (
            <p className="text-[13px] leading-relaxed text-muted">
              Ask about recurring feelings, themes, or what changed over a season. Example: “What
              patterns do you see in September?”
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={`${i}-${m.role}`}
              className={`max-w-[92%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                m.role === 'user'
                  ? 'ml-auto bg-[#007AFF] text-white'
                  : 'bg-[#F2F2F7] text-[#1C1C1E]'
              }`}
            >
              {m.content}
            </div>
          ))}
          {loading && <p className="text-[12px] text-muted">Thinking over your diary…</p>}
          {error && (
            <p className="rounded-xl bg-[#FF3B30]/10 px-3 py-2 text-[12px] text-[#FF3B30]">{error}</p>
          )}
          <div ref={bottomRef} />
        </div>

        <footer className="border-t border-hairline p-3">
          <div className="flex gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="Message your coach…"
              className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-hairline px-3 py-2 text-[13px] outline-none focus:border-[#007AFF]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
            />
            <button
              type="button"
              disabled={loading || !draft.trim()}
              onClick={() => void send()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#007AFF] text-white disabled:opacity-40"
              aria-label="Send"
            >
              <Send size={18} />
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
