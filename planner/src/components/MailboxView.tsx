import { useState } from 'react'
import { Mail, PenLine, Sparkles } from 'lucide-react'
import type { MailboxActions } from '../hooks/useMailbox'
import type { MailboxLetter, MailboxPrompt } from '../types/mailbox'
import { daysBetween, todayKey } from '../types/compass'
import { parseDateKey } from '../lib/weekUtils'
import { MailboxComposeSheet } from './MailboxComposeSheet'
import { MailboxLetterModal } from './MailboxLetterModal'
import { MailboxThreadHistory } from './MailboxThreadHistory'

interface MailboxViewProps {
  mailbox: MailboxActions
}

type ModalState =
  | { type: 'none' }
  | { type: 'letter'; letter: MailboxLetter }
  | { type: 'prompt'; prompt: MailboxPrompt }
  | { type: 'read_answer'; letter: MailboxLetter }
  | { type: 'history'; prompt: MailboxPrompt }

export function MailboxView({ mailbox }: MailboxViewProps) {
  const [composeOpen, setComposeOpen] = useState(false)
  const [modal, setModal] = useState<ModalState>({ type: 'none' })

  const today = todayKey()

  const handleSurprise = () => {
    const letter = mailbox.randomSurpriseLetter()
    if (letter) setModal({ type: 'read_answer', letter })
  }

  return (
    <div className="min-h-screen bg-[#FBF8F2] px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] pt-6 sm:px-6 sm:pb-24">
      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8D5C4]/80 text-[#8B6914] shadow-sm">
              <Mail size={22} />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight text-[#1C1C1E]">Mailbox</h1>
              <p className="text-[13px] text-muted">Letters & questions for future you</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-[#007AFF] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm"
          >
            <PenLine size={16} />
            Write
          </button>
        </div>

        <div className="mt-6 flex justify-center">
          <div className="relative">
            <div className="h-24 w-32 rounded-b-xl rounded-t-md bg-gradient-to-b from-[#D4A574] to-[#B8895A] shadow-lg" />
            <div className="absolute -top-1 left-1/2 h-3 w-14 -translate-x-1/2 rounded-sm bg-[#8B6914]/80" />
            {mailbox.unreadCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#FF3B30] px-1.5 text-[11px] font-bold text-white">
                {mailbox.unreadCount > 9 ? '9+' : mailbox.unreadCount}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={handleSurprise}
            className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-[#636366] ring-1 ring-hairline hover:bg-[#FAFAFA]"
          >
            <Sparkles size={14} />
            Surprise me
          </button>
        </div>
      </header>

        {mailbox.syncError && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FF3B30]/10 px-3 py-2 text-[12px] text-[#FF3B30]">
          <span>Sync issue: {mailbox.syncError}</span>
          <button
            type="button"
            onClick={() => void mailbox.refresh()}
            className="font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[#C7A882]">
          New mail
        </h2>
        {mailbox.dueLetters.length === 0 && mailbox.duePrompts.length === 0 ? (
          <p className="rounded-2xl bg-white/80 px-4 py-8 text-center text-[14px] text-muted ring-1 ring-hairline">
            No new mail today — your future letters are on their way.
          </p>
        ) : (
          <ul className="space-y-2">
            {mailbox.dueLetters.map((letter) => (
              <MailCard
                key={letter.id}
                title="Letter from past you"
                subtitle={`Arrived ${formatShort(letter.deliverOn)}`}
                tint="#E8D5C4"
                onClick={() => setModal({ type: 'letter', letter })}
              />
            ))}
            {mailbox.duePrompts.map((prompt) => (
              <MailCard
                key={prompt.id}
                title="Question for you"
                subtitle={prompt.body}
                tint={prompt.envelopeColor}
                onClick={() => setModal({ type: 'prompt', prompt })}
                onHistory={
                  mailbox.answersForPrompt(prompt.id).length > 0
                    ? () => setModal({ type: 'history', prompt })
                    : undefined
                }
              />
            ))}
          </ul>
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">Waiting</h2>
        {mailbox.waitingLetters.length === 0 && mailbox.waitingPrompts.length === 0 ? (
          <p className="text-[13px] text-muted">Nothing scheduled yet.</p>
        ) : (
          <ul className="space-y-2">
            {mailbox.waitingLetters.map((letter) => (
              <MailCard
                key={letter.id}
                title="Sealed letter"
                subtitle={`Arrives in ${daysBetween(today, letter.deliverOn)} days`}
                tint="#E8E8ED"
                dimmed
                onClick={() => {}}
                onDelete={() => {
                  if (window.confirm('Delete this sealed letter everywhere?')) {
                    void mailbox.deleteLetter(letter.id)
                  }
                }}
              />
            ))}
            {mailbox.waitingPrompts.map((prompt) => (
              <MailCard
                key={prompt.id}
                title="Next question"
                subtitle={`${prompt.body.length > 60 ? `${prompt.body.slice(0, 60)}…` : prompt.body} · in ${daysBetween(today, prompt.nextDueOn)}d`}
                tint={prompt.envelopeColor}
                dimmed
                onClick={() => setModal({ type: 'history', prompt })}
                onDelete={() => {
                  if (window.confirm('Delete this question and all its answers everywhere?')) {
                    void mailbox.deletePrompt(prompt.id)
                  }
                }}
              />
            ))}
          </ul>
        )}
      </section>

      {mailbox.loading && (
        <p className="text-center text-[12px] text-muted">Loading mailbox…</p>
      )}

      {composeOpen && (
        <MailboxComposeSheet
          onClose={() => setComposeOpen(false)}
          onSendLetter={(input) => mailbox.sendScheduledLetter(input)}
          onCreateQuestion={(input) => mailbox.createRepeatingQuestion(input)}
        />
      )}

      {modal.type === 'letter' && (
        <MailboxLetterModal
          mode="read_letter"
          letter={modal.letter}
          onClose={() => setModal({ type: 'none' })}
          onOpenLetter={() => void mailbox.openScheduledLetter(modal.letter.id)}
        />
      )}

      {modal.type === 'prompt' && (
        <MailboxLetterModal
          mode="answer_prompt"
          prompt={modal.prompt}
          onClose={() => setModal({ type: 'none' })}
          onSubmitAnswer={(body, feeling) => {
            void mailbox.submitPromptAnswer(modal.prompt.id, body, feeling)
            setModal({ type: 'none' })
          }}
        />
      )}

      {modal.type === 'read_answer' && (
        <MailboxLetterModal
          mode="read_answer"
          letter={modal.letter}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'history' && (
        <MailboxThreadHistory
          prompt={modal.prompt}
          answers={mailbox.answersForPrompt(modal.prompt.id)}
          onClose={() => setModal({ type: 'none' })}
          onOpenAnswer={(letter) => setModal({ type: 'read_answer', letter })}
          onDeletePrompt={() => {
            if (window.confirm('Delete this question and all answers on all devices?')) {
              void mailbox.deletePrompt(modal.prompt.id)
              setModal({ type: 'none' })
            }
          }}
          onDeleteAnswer={(letterId) => {
            if (window.confirm('Delete this answer everywhere?')) {
              void mailbox.deleteLetter(letterId)
            }
          }}
        />
      )}
    </div>
  )
}

function formatShort(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function MailCard({
  title,
  subtitle,
  tint,
  dimmed,
  onClick,
  onHistory,
  onDelete,
}: {
  title: string
  subtitle: string
  tint: string
  dimmed?: boolean
  onClick: () => void
  onHistory?: () => void
  onDelete?: () => void
}) {
  return (
    <li className={`flex gap-3 rounded-2xl bg-white p-3 ring-1 ring-hairline ${dimmed ? 'opacity-75' : ''}`}>
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 gap-3 text-left">
        <div
          className="mt-0.5 h-12 w-10 shrink-0 rounded-md shadow-sm"
          style={{ backgroundColor: tint }}
        />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[#1C1C1E]">{title}</p>
          <p className="line-clamp-2 text-[12px] text-muted">{subtitle}</p>
        </div>
      </button>
      <div className="flex shrink-0 flex-col justify-center gap-1">
        {onHistory && (
          <button
            type="button"
            onClick={onHistory}
            className="rounded-lg px-2 py-1 text-[11px] font-medium text-[#007AFF]"
          >
            History
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg px-2 py-1 text-[11px] font-medium text-[#FF3B30]"
          >
            Delete
          </button>
        )}
      </div>
    </li>
  )
}
