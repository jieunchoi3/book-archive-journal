import type { CharacterAppearance, AccessoryId } from '../../types/myRoom'
import {
  HAIR_COLORS,
  OUTFIT_COLORS,
  SKIN_TONES,
} from '../../types/myRoom'
import { RoomCharacter } from './RoomCharacter'

const ACCESSORY_OPTIONS: { id: AccessoryId; label: string }[] = [
  { id: 'glasses', label: 'Glasses' },
  { id: 'headphones', label: 'Headphones' },
  { id: 'camera', label: 'Camera' },
  { id: 'bag', label: 'Bag' },
  { id: 'book', label: 'Book' },
  { id: 'coffee', label: 'Coffee' },
  { id: 'flowers', label: 'Flowers' },
  { id: 'hat', label: 'Hat' },
  { id: 'scarf', label: 'Scarf' },
]

interface CharacterCustomizerProps {
  title: string
  value: CharacterAppearance
  onChange: (next: CharacterAppearance) => void
}

function Swatches({
  colors,
  selected,
  onSelect,
}: {
  colors: readonly string[]
  selected: number
  onSelect: (i: number) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c, i) => (
        <button
          key={c}
          type="button"
          onClick={() => onSelect(i)}
          className={`h-8 w-8 rounded-full border-2 transition-transform ${
            selected === i ? 'scale-110 border-[#5C4A3A]' : 'border-transparent'
          }`}
          style={{ backgroundColor: c }}
          aria-label={`Option ${i + 1}`}
        />
      ))}
    </div>
  )
}

export function CharacterCustomizer({ title, value, onChange }: CharacterCustomizerProps) {
  const toggleAccessory = (id: AccessoryId) => {
    const has = value.accessories.includes(id)
    onChange({
      ...value,
      accessories: has
        ? value.accessories.filter((a) => a !== id)
        : [...value.accessories, id],
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-[#F7F2EB] px-4 py-6">
        <p className="my-room-serif text-lg text-[#3D3229]">{title}</p>
        <RoomCharacter appearance={value} scale={1.35} />
      </div>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8B7355]">Skin</h4>
        <Swatches
          colors={SKIN_TONES}
          selected={value.skinTone}
          onSelect={(i) => onChange({ ...value, skinTone: i })}
        />
      </section>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8B7355]">Hair style</h4>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange({ ...value, hairStyle: i })}
              className={`flex h-14 w-14 items-center justify-center rounded-xl border ${
                value.hairStyle === i
                  ? 'border-[#5C4A3A] bg-white'
                  : 'border-[#E8DFD4] bg-[#FAF7F2]'
              }`}
            >
              <RoomCharacter
                appearance={{ ...value, hairStyle: i }}
                scale={0.45}
              />
            </button>
          ))}
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8B7355]">Hair colour</h4>
        <Swatches
          colors={HAIR_COLORS}
          selected={value.hairColor}
          onSelect={(i) => onChange({ ...value, hairColor: i })}
        />
      </section>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8B7355]">Outfit</h4>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange({ ...value, outfitStyle: i })}
              className={`flex h-14 w-14 items-center justify-center rounded-xl border ${
                value.outfitStyle === i
                  ? 'border-[#5C4A3A] bg-white'
                  : 'border-[#E8DFD4] bg-[#FAF7F2]'
              }`}
            >
              <RoomCharacter
                appearance={{ ...value, outfitStyle: i }}
                scale={0.45}
              />
            </button>
          ))}
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8B7355]">Outfit colour</h4>
        <Swatches
          colors={OUTFIT_COLORS}
          selected={value.outfitColor}
          onSelect={(i) => onChange({ ...value, outfitColor: i })}
        />
      </section>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8B7355]">Accessories</h4>
        <div className="flex flex-wrap gap-2">
          {ACCESSORY_OPTIONS.map(({ id, label }) => {
            const on = value.accessories.includes(id)
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleAccessory(id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  on
                    ? 'bg-[#5C4A3A] text-[#FAF7F2]'
                    : 'bg-[#EDE6DC] text-[#5C4A3A] hover:bg-[#E0D6CA]'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
