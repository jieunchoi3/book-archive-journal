import { useState } from 'react'
import type { AvatarConfig, RelationPerson } from '../../types/relationTracker'
import {
  DEFAULT_AVATAR,
  HAIR_COLORS,
  OUTFIT_COLORS,
  SKIN_TONES,
} from '../../types/relationTracker'
import { MiiAvatar } from './MiiAvatar'

type Draft = Omit<RelationPerson, 'id'>

interface NewFriendSheetProps {
  initial?: Partial<Draft> & { id?: string }
  onCancel: () => void
  onSave: (draft: Draft) => void
}

const TABS = ['Face', 'Hair', 'Outfit'] as const

export function NewFriendSheet({ initial, onCancel, onSave }: NewFriendSheetProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Face')
  const [draft, setDraft] = useState<Draft>(() => ({
    name: initial?.name ?? '',
    relationshipType: initial?.relationshipType ?? '',
    occupation: initial?.occupation ?? '',
    location: initial?.location ?? '',
    city: initial?.city,
    metContext: initial?.metContext ?? '',
    metDate: initial?.metDate ?? new Date().toISOString().slice(0, 10),
    quote: initial?.quote ?? '',
    age: initial?.age ?? '',
    mbti: initial?.mbti ?? '',
    compatibility: initial?.compatibility ?? 0,
    connectFrequency: initial?.connectFrequency ?? 'monthly',
    avatar: { ...DEFAULT_AVATAR, ...initial?.avatar },
    lastInteraction: new Date().toISOString().slice(0, 10),
  }))

  const setAvatar = (patch: Partial<AvatarConfig>) => {
    setDraft((d) => ({ ...d, avatar: { ...d.avatar, ...patch } }))
  }

  const canSave = draft.name.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="flex max-h-[95dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-[#F9F8F3] shadow-2xl sm:max-h-[90dvh] sm:flex-row sm:rounded-3xl">
        <aside className="flex shrink-0 flex-col border-b border-hairline bg-[#f0eeea] sm:w-[42%] sm:border-b-0 sm:border-r">
          <div className="flex items-center justify-between px-4 py-3 sm:hidden">
            <button type="button" onClick={onCancel} className="text-[13px]">
              Cancel
            </button>
            <span className="font-serif text-[17px] font-semibold">New friend</span>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => canSave && onSave(draft)}
              className="text-[13px] font-medium text-[#6B8F71] disabled:opacity-40"
            >
              Done
            </button>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-6">
            <p className="mb-4 text-[12px] text-muted">Customize their look</p>
            <MiiAvatar avatar={draft.avatar} size={140} />
            <div className="mt-6 flex w-full gap-2">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`flex-1 border-b-2 py-2 text-[12px] font-medium ${
                    tab === t
                      ? 'border-[#6B8F71] text-[#1C1C1E]'
                      : 'border-transparent text-muted'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="mt-4 w-full space-y-4 px-2">
              {tab === 'Face' && (
                <>
                  <SwatchRow
                    label="Skin tone"
                    options={SKIN_TONES}
                    value={draft.avatar.skinTone}
                    onChange={(i) => setAvatar({ skinTone: i })}
                  />
                  <GridPick
                    label="Eye shape"
                    count={5}
                    value={draft.avatar.eyeStyle}
                    onChange={(i) => setAvatar({ eyeStyle: i })}
                  />
                  <GridPick
                    label="Mouth"
                    count={5}
                    value={draft.avatar.mouthStyle}
                    onChange={(i) => setAvatar({ mouthStyle: i })}
                  />
                </>
              )}
              {tab === 'Hair' && (
                <>
                  <GridPick
                    label="Hair style"
                    count={4}
                    value={draft.avatar.hairStyle}
                    onChange={(i) => setAvatar({ hairStyle: i })}
                  />
                  <SwatchRow
                    label="Hair color"
                    options={HAIR_COLORS}
                    value={draft.avatar.hairColor}
                    onChange={(i) => setAvatar({ hairColor: i })}
                  />
                </>
              )}
              {tab === 'Outfit' && (
                <>
                  <SwatchRow
                    label="Outfit color"
                    options={OUTFIT_COLORS}
                    value={draft.avatar.outfitColor}
                    onChange={(i) => setAvatar({ outfitColor: i })}
                  />
                  <GridPick
                    label="Style"
                    count={2}
                    value={draft.avatar.outfitStyle}
                    onChange={(i) => setAvatar({ outfitStyle: i })}
                  />
                </>
              )}
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <header className="hidden items-center justify-between border-b border-hairline px-6 py-4 sm:flex">
            <div>
              <h2 className="font-serif text-[26px] font-semibold text-[#1C1C1E]">
                New friend
              </h2>
              <p className="text-[13px] text-muted">Add someone to your world.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full px-4 py-2 text-[13px] font-medium text-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSave}
                onClick={() => canSave && onSave(draft)}
                className="rounded-full bg-[#6B8F71] px-5 py-2 text-[13px] font-medium text-white disabled:opacity-40"
              >
                Done
              </button>
            </div>
          </header>

          <div className="space-y-6 px-4 py-5 sm:px-6">
            <FormSection title="Basic information">
              <Field label="Name *">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Sophie"
                  className={inputClass}
                />
              </Field>
              <Field label="Age">
                <input
                  value={draft.age ?? ''}
                  onChange={(e) => setDraft({ ...draft, age: e.target.value })}
                  placeholder="e.g. 24"
                  className={inputClass}
                />
              </Field>
              <Field label="Occupation / Field">
                <input
                  value={draft.occupation}
                  onChange={(e) =>
                    setDraft({ ...draft, occupation: e.target.value })
                  }
                  placeholder="Design, Psychology…"
                  className={inputClass}
                />
              </Field>
              <Field label="MBTI">
                <input
                  value={draft.mbti ?? ''}
                  onChange={(e) => setDraft({ ...draft, mbti: e.target.value })}
                  placeholder="ENFP"
                  className={inputClass}
                />
              </Field>
              <Field label="Currently living in">
                <input
                  value={draft.location}
                  onChange={(e) =>
                    setDraft({ ...draft, location: e.target.value })
                  }
                  placeholder="London, UK"
                  className={inputClass}
                />
              </Field>
            </FormSection>

            <FormSection title="How you met">
              <Field label="Context">
                <input
                  value={draft.metContext}
                  onChange={(e) =>
                    setDraft({ ...draft, metContext: e.target.value })
                  }
                  placeholder="University, travel, work…"
                  className={inputClass}
                />
              </Field>
              <Field label="Date you first met">
                <input
                  type="date"
                  value={draft.metDate}
                  onChange={(e) =>
                    setDraft({ ...draft, metDate: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
            </FormSection>

            <FormSection title="Your relationship">
              <Field label="Relationship type">
                <input
                  value={draft.relationshipType}
                  onChange={(e) =>
                    setDraft({ ...draft, relationshipType: e.target.value })
                  }
                  placeholder="Close friend, colleague…"
                  className={inputClass}
                />
              </Field>
              <Field label="What do you appreciate?">
                <textarea
                  value={draft.quote ?? ''}
                  onChange={(e) => setDraft({ ...draft, quote: e.target.value })}
                  placeholder="They're always so kind…"
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </Field>
              <div>
                <span className="mb-2 block text-[12px] text-muted">
                  Compatibility
                </span>
                <StarRating
                  value={draft.compatibility ?? 0}
                  onChange={(n) => setDraft({ ...draft, compatibility: n })}
                />
              </div>
              <div>
                <span className="mb-2 block text-[12px] text-muted">
                  How often do you want to connect?
                </span>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['weekly', 'Weekly'],
                      ['monthly', 'Monthly'],
                      ['few_months', 'Every few months'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setDraft({ ...draft, connectFrequency: key })
                      }
                      className={`rounded-full px-3 py-1.5 text-[12px] ${
                        draft.connectFrequency === key
                          ? 'bg-[#6B8F71] text-white'
                          : 'bg-white text-[#48484A] ring-1 ring-hairline'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </FormSection>

            <button
              type="button"
              disabled={!canSave}
              onClick={() => canSave && onSave(draft)}
              className="mb-6 w-full rounded-full bg-[#6B8F71] py-3.5 text-[14px] font-medium text-white disabled:opacity-40 sm:hidden"
            >
              Invite into my room
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#6B8F71]'

function FormSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h3 className="mb-3 text-[13px] font-semibold text-[#1C1C1E]">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-muted">{label}</span>
      {children}
    </label>
  )
}

function SwatchRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: number
  onChange: (i: number) => void
}) {
  return (
    <div>
      <span className="mb-2 block text-[11px] text-muted">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((c, i) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(i)}
            className={`h-8 w-8 rounded-full ring-2 ring-offset-2 ${
              value === i ? 'ring-[#6B8F71]' : 'ring-transparent'
            }`}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  )
}

function GridPick({
  label,
  count,
  value,
  onChange,
}: {
  label: string
  count: number
  value: number
  onChange: (i: number) => void
}) {
  return (
    <div>
      <span className="mb-2 block text-[11px] text-muted">{label}</span>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={`aspect-square rounded-lg bg-white text-[12px] ring-1 ${
              value === i ? 'ring-2 ring-[#6B8F71]' : 'ring-hairline'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  )
}

function StarRating({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? 0 : n)}
          className={`text-xl ${n <= value ? 'text-[#6B8F71]' : 'text-hairline'}`}
          aria-label={`${n} stars`}
        >
          ★
        </button>
      ))}
      {value === 0 && (
        <span className="ml-2 self-center text-[12px] text-muted">Not set yet</span>
      )}
    </div>
  )
}
