import { useState } from 'react'
import { X } from 'lucide-react'
import { MAILBOX_DELIVER_PRESETS, MAILBOX_ENVELOPE_COLORS } from '../types/mailbox'

type ComposeMode = 'letter' | 'question'

interface MailboxComposeSheetProps {
  onClose: () => void
  onSendLetter: (input: {
    body: string
    deliverInDays: number
    envelopeColor: string
  }) => void | Promise<void>
  onCreateQuestion: (input: {
    body: string
    cadenceDays: number
    firstAnswer: string
    feeling: number | null
    envelopeColor: string
  }) => void | Promise<void>
}

export function MailboxComposeSheet({
  onClose,
  onSendLetter,
  onCreateQuestion,
}: MailboxComposeSheetProps) {
  const [mode, setMode] = useState<ComposeMode>('letter')
  const [body, setBody] = useState('')
  const [firstAnswer, setFirstAnswer] = useState('')
  const [deliverDays, setDeliverDays] = useState(30)
  const [cadenceDays, setCadenceDays] = useState(30)
  const [feeling, setFeeling] = useState<number | null>(null)
  const [color, setColor] = useState<string>(MAILBOX_ENVELOPE_COLORS[0])
  const [customDays, setCustomDays] = useState('')

  const MOOD = ['', '😔', '😐', '🙂', '😊', '🤩']

  const effectiveDeliver =
    customDays.trim() && mode === 'letter'
      ? Math.max(1, parseInt(customDays, 10) || deliverDays)
      : deliverDays

  const handleSubmit = () => {
    if (mode === 'letter') {
      void onSendLetter({ body, deliverInDays: effectiveDeliver, envelopeColor: color })
    } else {
      void onCreateQuestion({
        body,
        cadenceDays,
        firstAnswer,
        feeling,
        envelopeColor: color,
      })
    }
    onClose()
  }

  const canSubmit =
    mode === 'letter'
      ? body.trim().length > 0
      : body.trim().length > 0 && firstAnswer.trim().length > 0

  return (
    <div
      className="fixed inset-0 z-[75] flex items-end justify-center bg-[#3D3429]/35 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[#FFFCF7] shadow-[0_24px_80px_rgba(61,52,41,0.2)] ring-1 ring-[#E8D5C4]/60 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <h2 className="mailbox-serif text-[20px] text-[#3D3429]">Write to future you</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <div className="mb-4 flex rounded-xl bg-white p-1 ring-1 ring-hairline">
            <button
              type="button"
              onClick={() => setMode('letter')}
              className={`flex-1 rounded-lg py-2 text-[13px] font-medium ${
                mode === 'letter' ? 'bg-[#3D3429] text-[#FBF8F2]' : 'text-muted'
              }`}
            >
              Letter
            </button>
            <button
              type="button"
              onClick={() => setMode('question')}
              className={`flex-1 rounded-lg py-2 text-[13px] font-medium ${
                mode === 'question' ? 'bg-[#3D3429] text-[#FBF8F2]' : 'text-muted'
              }`}
            >
              Repeating question
            </button>
          </div>

          <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-muted">
            {mode === 'letter' ? 'Your letter' : 'Your question'}
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder={
              mode === 'letter'
                ? 'Dear future me…'
                : 'What do you think happiness is?'
            }
            className="w-full resize-none rounded-xl border border-hairline bg-white px-3.5 py-3 text-[15px] outline-none focus:ring-2 focus:ring-[#007AFF]/15"
          />

          {mode === 'question' && (
            <>
              <label className="mb-1.5 mt-4 block text-[12px] font-semibold uppercase tracking-wide text-muted">
                Your answer today
              </label>
              <textarea
                value={firstAnswer}
                onChange={(e) => setFirstAnswer(e.target.value)}
                rows={4}
                placeholder="Write how you feel right now…"
                className="w-full resize-none rounded-xl border border-hairline bg-white px-3.5 py-3 text-[15px] outline-none focus:ring-2 focus:ring-[#007AFF]/15"
              />
              <p className="mt-3 text-[11px] font-medium text-muted">Mood (optional)</p>
              <div className="mt-1 flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFeeling(feeling === n ? null : n)}
                    className={`rounded-lg px-2 py-1 text-lg ${
                      feeling === n ? 'ring-2 ring-[#007AFF]/40' : ''
                    }`}
                  >
                    {MOOD[n]}
                  </button>
                ))}
              </div>
              <label className="mb-1.5 mt-4 block text-[12px] font-semibold uppercase tracking-wide text-muted">
                Ask again every (days)
              </label>
              <div className="flex flex-wrap gap-2">
                {MAILBOX_DELIVER_PRESETS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setCadenceDays(d)}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${
                      cadenceDays === d
                        ? 'bg-[#007AFF] text-white'
                        : 'bg-white ring-1 ring-hairline text-[#636366]'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  value={cadenceDays}
                  onChange={(e) => setCadenceDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-20 rounded-full border border-hairline px-2 py-1.5 text-center text-[12px]"
                />
              </div>
            </>
          )}

          {mode === 'letter' && (
            <>
              <label className="mb-1.5 mt-4 block text-[12px] font-semibold uppercase tracking-wide text-muted">
                Deliver in
              </label>
              <div className="flex flex-wrap gap-2">
                {MAILBOX_DELIVER_PRESETS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setDeliverDays(d)
                      setCustomDays('')
                    }}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${
                      deliverDays === d && !customDays
                        ? 'bg-[#007AFF] text-white'
                        : 'bg-white ring-1 ring-hairline text-[#636366]'
                    }`}
                  >
                    {d} days
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  placeholder="Custom"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  className="w-24 rounded-full border border-hairline px-2 py-1.5 text-center text-[12px]"
                />
              </div>
            </>
          )}

          <p className="mb-2 mt-4 text-[11px] font-medium text-muted">Envelope color</p>
          <div className="flex flex-wrap gap-2">
            {MAILBOX_ENVELOPE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full ring-2 ${
                  color === c ? 'ring-[#007AFF]' : 'ring-transparent'
                }`}
                style={{ backgroundColor: c }}
                aria-label="Envelope color"
              />
            ))}
          </div>

          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="mt-6 w-full rounded-2xl bg-[#007AFF] py-3.5 text-[15px] font-semibold text-white shadow-sm disabled:opacity-40"
          >
            Seal & send
          </button>
        </div>
      </div>
    </div>
  )
}
