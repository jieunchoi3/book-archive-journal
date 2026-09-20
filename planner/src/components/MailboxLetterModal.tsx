import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { MailboxLetter, MailboxPrompt } from '../types/mailbox'
import { parseDateKey } from '../lib/weekUtils'

const MOOD_LABELS = ['', '😔', '😐', '🙂', '😊', '🤩']

interface MailboxLetterModalProps {
  mode: 'read_letter' | 'answer_prompt' | 'read_answer'
  letter?: MailboxLetter | null
  prompt?: MailboxPrompt | null
  onClose: () => void
  onOpenLetter?: () => void
  onSubmitAnswer?: (body: string, feeling: number | null) => void
}

function formatLongDate(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function MailboxLetterModal({
  mode,
  letter,
  prompt,
  onClose,
  onOpenLetter,
  onSubmitAnswer,
}: MailboxLetterModalProps) {
  const [answer, setAnswer] = useState('')
  const [feeling, setFeeling] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(mode !== 'read_letter' || Boolean(letter?.openedAt))

  useEffect(() => {
    setAnswer('')
    setFeeling(null)
    setRevealed(mode !== 'read_letter' || Boolean(letter?.openedAt))
  }, [mode, letter?.id, letter?.openedAt])

  const envelopeColor = prompt?.envelopeColor ?? '#E8D5C4'

  const handleReveal = () => {
    onOpenLetter?.()
    setRevealed(true)
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-lg overflow-hidden rounded-3xl bg-[#FBF8F2] shadow-2xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-white/80 p-2 text-muted shadow-sm backdrop-blur hover:bg-white"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {!revealed && letter ? (
          <div className="flex flex-col items-center px-8 py-16">
            <div
              className="mb-6 h-28 w-40 rounded-b-2xl rounded-t-lg shadow-md"
              style={{ backgroundColor: envelopeColor }}
            />
            <p className="text-center text-[15px] font-medium text-[#1C1C1E]">
              A letter from your past self
            </p>
            <p className="mt-1 text-center text-[13px] text-muted">
              Arrived {formatLongDate(letter.deliverOn)}
            </p>
            <button
              type="button"
              onClick={handleReveal}
              className="mt-8 rounded-2xl bg-[#007AFF] px-6 py-3 text-[15px] font-semibold text-white shadow-sm"
            >
              Open letter
            </button>
          </div>
        ) : (
          <div className="overflow-y-auto px-6 pb-8 pt-10">
            <div className="mx-auto max-w-md rounded-2xl bg-white px-5 py-6 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)] ring-1 ring-black/[0.04]">
              {mode === 'answer_prompt' && prompt ? (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#C7A882]">
                    Question for you
                  </p>
                  <h2 className="mt-2 font-serif text-[20px] font-semibold leading-snug text-[#1C1C1E]">
                    {prompt.body}
                  </h2>
                  <p className="mt-2 text-[12px] text-muted">
                    {formatLongDate(prompt.nextDueOn)} · every {prompt.cadenceDays} days
                  </p>
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Write your answer to future you…"
                    rows={6}
                    className="mt-5 w-full resize-none rounded-xl border border-hairline bg-[#FAFAFA] px-3.5 py-3 text-[15px] leading-relaxed text-[#1C1C1E] outline-none focus:border-[#007AFF]/40 focus:ring-2 focus:ring-[#007AFF]/15"
                  />
                  <p className="mt-3 text-[11px] font-medium text-muted">Mood (optional)</p>
                  <div className="mt-1.5 flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setFeeling(feeling === n ? null : n)}
                        className={`rounded-lg px-2 py-1 text-lg ${
                          feeling === n ? 'bg-[#007AFF]/15 ring-2 ring-[#007AFF]/40' : 'bg-[#F2F2F7]'
                        }`}
                      >
                        {MOOD_LABELS[n]}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={!answer.trim()}
                    onClick={() => onSubmitAnswer?.(answer, feeling)}
                    className="mt-6 w-full rounded-2xl bg-[#007AFF] py-3 text-[15px] font-semibold text-white disabled:opacity-40"
                  >
                    Seal & send answer
                  </button>
                </>
              ) : letter ? (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#C7A882]">
                    {letter.kind === 'prompt_answer' ? 'Your past answer' : 'Letter'}
                  </p>
                  <p className="mt-1 text-[13px] text-muted">{formatLongDate(letter.writtenOn)}</p>
                  <p className="mt-5 whitespace-pre-wrap font-serif text-[17px] leading-relaxed text-[#1C1C1E]">
                    {letter.body}
                  </p>
                  {letter.feeling ? (
                    <p className="mt-4 text-[24px]" title="Mood">
                      {MOOD_LABELS[letter.feeling]}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
