import { useState } from 'react'
import { Clock3, Feather, Heart, PenLine, Sparkles } from 'lucide-react'
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

  const hasNew = mailbox.dueLetters.length > 0 || mailbox.duePrompts.length > 0
  const hasWaiting = mailbox.waitingLetters.length > 0 || mailbox.waitingPrompts.length > 0

  return (
    <div className="mailbox-page relative min-h-screen overflow-x-hidden px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] pt-5 sm:px-6 sm:pb-24 sm:pt-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        aria-hidden
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 50% at 20% -10%, rgba(245, 198, 214, 0.35), transparent 55%),
            radial-gradient(ellipse 70% 45% at 90% 10%, rgba(201, 228, 222, 0.4), transparent 50%),
            radial-gradient(ellipse 60% 40% at 50% 100%, rgba(232, 213, 196, 0.45), transparent 55%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: 'radial-gradient(circle, #8b6914 0.6px, transparent 0.6px)',
          backgroundSize: '22px 22px',
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-2xl">
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mailbox-serif mb-1 text-[13px] tracking-[0.2em] text-[#A67C52] uppercase">
                Future self
              </p>
              <h1 className="mailbox-serif text-[clamp(1.75rem,5vw,2.25rem)] leading-tight text-[#3D3429]">
                Mailbox
              </h1>
              <p className="mt-2 max-w-[16rem] text-[14px] leading-relaxed text-[#6B5E52]">
                편지와 질문을 모아두는 작은 서랍 — 나중의 너에게 전해줄 말들
              </p>
            </div>
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              className="group inline-flex shrink-0 items-center gap-2 rounded-full bg-[#3D3429] px-4 py-2.5 text-[13px] font-medium text-[#FBF8F2] shadow-[0_8px_24px_rgba(61,52,41,0.22)] transition hover:bg-[#524839] hover:shadow-[0_12px_28px_rgba(61,52,41,0.28)]"
            >
              <PenLine size={15} className="transition group-hover:-rotate-12" />
              Write
            </button>
          </div>

          <div className="mt-8 flex flex-col items-center">
            <div className="relative">
              <div className="mailbox-hero-envelope flex h-[5.5rem] w-[7.5rem] flex-col items-center justify-end rounded-b-2xl rounded-t-lg bg-gradient-to-b from-[#E8C9A8] via-[#D4A574] to-[#B8895A] pb-3 shadow-[0_18px_40px_rgba(139,105,20,0.25)]">
                <div className="absolute -top-2 left-1/2 h-4 w-[4.5rem] -translate-x-1/2 rounded-sm bg-[#8B6914]/75 shadow-sm" />
                <Heart
                  size={18}
                  className="text-[#FFF8F0]/90 drop-shadow-sm"
                  fill="currentColor"
                  strokeWidth={1.5}
                />
              </div>
              {mailbox.unreadCount > 0 && (
                <span className="absolute -right-3 -top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-[#C45C5C] px-2 text-[11px] font-bold text-white shadow-md ring-2 ring-[#FBF8F2]">
                  {mailbox.unreadCount > 9 ? '9+' : mailbox.unreadCount}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleSurprise}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#E8D5C4]/90 bg-white/75 px-4 py-2 text-[12px] font-medium text-[#6B5E52] shadow-[0_4px_20px_rgba(0,0,0,0.04)] backdrop-blur-sm transition hover:border-[#D4A574] hover:bg-white hover:text-[#3D3429]"
            >
              <Sparkles size={14} className="text-[#C9A227]" />
              Surprise me — pick a memory
            </button>
          </div>
        </header>

        {mailbox.syncError && (
          <p className="mb-4 rounded-2xl bg-[#FF3B30]/8 px-4 py-2.5 text-[12px] text-[#B42318] ring-1 ring-[#FF3B30]/15">
            Sync issue: {mailbox.syncError}
          </p>
        )}

        <section className="mb-10">
          <SectionLabel icon={<Feather size={14} />} label="New mail" accent />
          {!hasNew ? (
            <div className="mailbox-empty-pin rounded-[1.35rem] px-6 py-10 text-center shadow-[0_12px_40px_rgba(61,52,41,0.06)] ring-1 ring-[#E8D5C4]/60">
              <p className="mailbox-serif text-[17px] text-[#3D3429]">오늘은 조용한 우편함</p>
              <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-[#8B7D6F]">
                예약해 둔 편지가 도착하면 여기에 놓일 거예요. 지금은 미래의 너를 위해 한 줄
                적어볼까요?
              </p>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {mailbox.dueLetters.map((letter, i) => (
                <MailPin
                  key={letter.id}
                  variant="letter"
                  title="Letter from past you"
                  subtitle={`Arrived ${formatShort(letter.deliverOn)}`}
                  tint="#E8D5C4"
                  tilt={i % 2 === 0 ? -1.2 : 1.4}
                  onClick={() => setModal({ type: 'letter', letter })}
                />
              ))}
              {mailbox.duePrompts.map((prompt, i) => (
                <MailPin
                  key={prompt.id}
                  variant="question"
                  title="Question for you"
                  subtitle={prompt.body}
                  tint={prompt.envelopeColor}
                  tilt={i % 2 === 0 ? 1.5 : -0.8}
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

        <section className="mb-8">
          <SectionLabel icon={<Clock3 size={14} />} label="Waiting" />
          {!hasWaiting ? (
            <p className="text-[13px] leading-relaxed text-[#8B7D6F]">
              아직 도착 예정인 편지가 없어요. Write로 미래의 나에게 보낼 편지를 예약해 보세요.
            </p>
          ) : (
            <ul className="columns-1 gap-4 sm:columns-2">
              {mailbox.waitingLetters.map((letter, i) => (
                <li key={letter.id} className="mb-4 break-inside-avoid">
                  <MailPin
                    variant="sealed"
                    title="Sealed letter"
                    subtitle={`Arrives in ${daysBetween(today, letter.deliverOn)} days`}
                    tint="#E8E8ED"
                    tilt={((i % 5) - 2) * 0.9}
                    dimmed
                    onClick={() => {}}
                  />
                </li>
              ))}
              {mailbox.waitingPrompts.map((prompt, i) => (
                <li key={prompt.id} className="mb-4 break-inside-avoid">
                  <MailPin
                    variant="question"
                    title="Next question"
                    subtitle={`${prompt.body.slice(0, 72)}${prompt.body.length > 72 ? '…' : ''} · in ${daysBetween(today, prompt.nextDueOn)}d`}
                    tint={prompt.envelopeColor}
                    tilt={((i % 4) - 1.5) * 1.1}
                    dimmed
                    onClick={() => setModal({ type: 'history', prompt })}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {mailbox.loading && (
          <p className="text-center text-[12px] text-[#8B7D6F]">Loading mailbox…</p>
        )}
      </div>

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
        />
      )}
    </div>
  )
}

function SectionLabel({
  label,
  icon,
  accent,
}: {
  label: string
  icon: React.ReactNode
  accent?: boolean
}) {
  return (
    <div className={`mb-3 flex items-center gap-2 ${accent ? 'text-[#A67C52]' : 'text-[#8B7D6F]'}`}>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 shadow-sm ring-1 ring-[#E8D5C4]/50">
        {icon}
      </span>
      <h2 className="text-[11px] font-semibold tracking-[0.22em] uppercase">{label}</h2>
    </div>
  )
}

function formatShort(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function MailPin({
  title,
  subtitle,
  tint,
  variant,
  tilt,
  dimmed,
  onClick,
  onHistory,
}: {
  title: string
  subtitle: string
  tint: string
  variant: 'letter' | 'question' | 'sealed'
  tilt: number
  dimmed?: boolean
  onClick: () => void
  onHistory?: () => void
}) {
  const stamp =
    variant === 'letter' ? '✉' : variant === 'question' ? '?' : '🔒'

  return (
    <div
      className={`group ${dimmed ? 'opacity-[0.88]' : ''}`}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <div className="mailbox-pin relative overflow-hidden rounded-[1.25rem] bg-[#FFFCF7] p-4 shadow-[0_10px_32px_rgba(61,52,41,0.08)] ring-1 ring-[#E8D5C4]/55 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(61,52,41,0.12)]">
        <div
          className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-40 blur-2xl"
          style={{ backgroundColor: tint }}
          aria-hidden
        />
        <div className="flex gap-3">
          <div className="relative shrink-0">
            <div
              className="flex h-[4.5rem] w-[3.25rem] flex-col items-center justify-end rounded-md rounded-t-sm pb-2 shadow-[inset_0_-4px_8px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.08)]"
              style={{
                background: `linear-gradient(165deg, ${tint} 0%, color-mix(in srgb, ${tint} 70%, #8B6914) 100%)`,
              }}
            >
              <span className="text-[11px] opacity-80">{stamp}</span>
            </div>
            <div className="absolute -bottom-1 left-1/2 h-1 w-[85%] -translate-x-1/2 rounded-full bg-black/10 blur-[2px]" />
          </div>
          <div className="min-w-0 flex-1">
            <button type="button" onClick={onClick} className="w-full text-left">
              <p className="mailbox-serif text-[15px] leading-snug text-[#3D3429]">{title}</p>
              <p className="mt-1.5 line-clamp-3 text-[12px] leading-relaxed text-[#6B5E52]">
                {subtitle}
              </p>
            </button>
            {onHistory && (
              <button
                type="button"
                onClick={onHistory}
                className="mt-2 text-[11px] font-medium tracking-wide text-[#A67C52] underline-offset-2 hover:underline"
              >
                Past answers
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
