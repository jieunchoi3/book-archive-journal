import { useState } from 'react'
import { X } from 'lucide-react'
import type { MailboxLetter, MailboxPrompt } from '../types/mailbox'
import { parseDateKey } from '../lib/weekUtils'

interface MailboxThreadHistoryProps {
  prompt: MailboxPrompt
  answers: MailboxLetter[]
  onClose: () => void
  onOpenAnswer: (letter: MailboxLetter) => void
}

export function MailboxThreadHistory({
  prompt,
  answers,
  onClose,
  onOpenAnswer,
}: MailboxThreadHistoryProps) {
  const [compareA, setCompareA] = useState<string | null>(null)
  const [compareB, setCompareB] = useState<string | null>(null)

  const letterA = answers.find((a) => a.id === compareA)
  const letterB = answers.find((a) => a.id === compareB)
  const comparing = letterA && letterB

  const toggleSelect = (id: string) => {
    if (compareA === id) {
      setCompareA(null)
      return
    }
    if (compareB === id) {
      setCompareB(null)
      return
    }
    if (!compareA) setCompareA(id)
    else if (!compareB) setCompareB(id)
    else setCompareA(id)
  }

  return (
    <div
      className="fixed inset-0 z-[78] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-[#FBF8F2] shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-hairline px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Past answers</p>
            <h2 className="mt-1 font-serif text-[18px] font-semibold leading-snug text-[#1C1C1E]">
              {prompt.body}
            </h2>
            <p className="mt-1 text-[12px] text-muted">
              Select two to compare · {answers.length} {answers.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-white">
            <X size={18} />
          </button>
        </div>

        {comparing ? (
          <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2">
            {[letterA, letterB].map((letter) =>
              letter ? (
                <div
                  key={letter.id}
                  className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-hairline"
                >
                  <p className="text-[12px] font-medium text-muted">
                    {parseDateKey(letter.writtenOn).toLocaleDateString()}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-[#1C1C1E]">
                    {letter.body}
                  </p>
                </div>
              ) : null,
            )}
            <button
              type="button"
              onClick={() => {
                setCompareA(null)
                setCompareB(null)
              }}
              className="sm:col-span-2 rounded-xl bg-white py-2 text-[13px] font-medium text-[#007AFF] ring-1 ring-hairline"
            >
              Clear comparison
            </button>
          </div>
        ) : (
          <ul className="flex-1 space-y-2 overflow-y-auto p-4">
            {answers.map((answer) => {
              const selected = compareA === answer.id || compareB === answer.id
              return (
                <li key={answer.id}>
                  <button
                    type="button"
                    onClick={() => toggleSelect(answer.id)}
                    onDoubleClick={() => onOpenAnswer(answer)}
                    className={`w-full rounded-2xl px-4 py-3 text-left ring-1 transition ${
                      selected
                        ? 'bg-[#007AFF]/10 ring-[#007AFF]/40'
                        : 'bg-white ring-hairline hover:shadow-sm'
                    }`}
                  >
                    <p className="text-[12px] font-medium text-muted">
                      {parseDateKey(answer.writtenOn).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="mt-1 line-clamp-3 text-[14px] text-[#1C1C1E]">{answer.body}</p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
