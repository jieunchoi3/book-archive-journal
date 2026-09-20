import { useState } from 'react'
import type { CharacterAppearance } from '../../types/myRoom'
import { RELATIONSHIP_OPTIONS, defaultCharacter } from '../../types/myRoom'
import { CharacterCustomizer } from './CharacterCustomizer'
import { DOOR_X, DOOR_Y } from './roomConstants'

type Step = 'details' | 'character' | 'confirm'

interface InvitePersonSheetProps {
  open: boolean
  onClose: () => void
  onInvite: (input: {
    name: string
    relationship: string
    dateMet: string | null
    lastMet: string | null
    valueNote: string
    character: CharacterAppearance
  }) => void
  /** Person exists but not in room — invite only */
  existingName?: string
  onInviteExisting?: () => void
}

export function InvitePersonSheet({
  open,
  onClose,
  onInvite,
  existingName,
  onInviteExisting,
}: InvitePersonSheetProps) {
  const [step, setStep] = useState<Step>('details')
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState<string>(RELATIONSHIP_OPTIONS[0])
  const [dateMet, setDateMet] = useState('')
  const [lastMet, setLastMet] = useState('')
  const [valueNote, setValueNote] = useState('')
  const [character, setCharacter] = useState<CharacterAppearance>(defaultCharacter())

  if (!open) return null

  const reset = () => {
    setStep('details')
    setName('')
    setRelationship(RELATIONSHIP_OPTIONS[0])
    setDateMet('')
    setLastMet('')
    setValueNote('')
    setCharacter(defaultCharacter())
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  if (existingName && onInviteExisting) {
    return (
      <SheetShell onClose={handleClose} title={`Invite ${existingName}`}>
        <p className="text-sm text-[#5C4A3A]">
          They will enter through the door and you can place them anywhere in your room.
        </p>
        <button
          type="button"
          className="my-room-primary-btn mt-6 w-full"
          onClick={() => {
            onInviteExisting()
            handleClose()
          }}
        >
          Invite into my room
        </button>
      </SheetShell>
    )
  }

  return (
    <SheetShell
      onClose={handleClose}
      title={step === 'character' ? `Customize ${name || 'them'}` : 'Invite someone'}
    >
      {step === 'details' && (
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-[#8B7355]">Name</span>
            <input
              className="my-room-input mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sophie"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[#8B7355]">Relationship</span>
            <select
              className="my-room-input mt-1"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
            >
              {RELATIONSHIP_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-[#8B7355]">When did you meet?</span>
              <input
                type="date"
                className="my-room-input mt-1"
                value={dateMet}
                onChange={(e) => setDateMet(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[#8B7355]">Last met</span>
              <input
                type="date"
                className="my-room-input mt-1"
                value={lastMet}
                onChange={(e) => setLastMet(e.target.value)}
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-[#8B7355]">What do I value about them?</span>
            <textarea
              className="my-room-input mt-1 min-h-[80px] resize-y"
              value={valueNote}
              onChange={(e) => setValueNote(e.target.value)}
              placeholder="Optional reflection…"
            />
          </label>
          <button
            type="button"
            disabled={!name.trim()}
            className="my-room-primary-btn w-full disabled:opacity-40"
            onClick={() => setStep('character')}
          >
            Next · Character
          </button>
        </div>
      )}

      {step === 'character' && (
        <div>
          <CharacterCustomizer
            title={name}
            value={character}
            onChange={setCharacter}
          />
          <div className="mt-6 flex gap-2">
            <button type="button" className="my-room-ghost-btn flex-1" onClick={() => setStep('details')}>
              Back
            </button>
            <button
              type="button"
              className="my-room-primary-btn flex-1"
              onClick={() => setStep('confirm')}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-4 text-center">
          <p className="my-room-serif text-xl text-[#3D3229]">{name}</p>
          <p className="text-sm text-[#5C4A3A]">
            They will enter through the door. You can drag them anywhere in your room — distance is
            yours to interpret.
          </p>
          <button
            type="button"
            className="my-room-primary-btn w-full"
            onClick={() => {
              onInvite({
                name: name.trim(),
                relationship,
                dateMet: dateMet || null,
                lastMet: lastMet || null,
                valueNote,
                character,
              })
              handleClose()
            }}
          >
            Invite them into my room
          </button>
          <button type="button" className="my-room-ghost-btn w-full" onClick={() => setStep('character')}>
            Back
          </button>
        </div>
      )}
    </SheetShell>
  )
}

function SheetShell({
  children,
  title,
  onClose,
}: {
  children: React.ReactNode
  title: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-[#FAF7F2] p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="my-room-serif text-lg text-[#3D3229]">{title}</h2>
          <button type="button" onClick={onClose} className="text-sm text-[#8B7355]">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function doorPlacement() {
  return { x: DOOR_X - 160, y: DOOR_Y + 20 }
}
