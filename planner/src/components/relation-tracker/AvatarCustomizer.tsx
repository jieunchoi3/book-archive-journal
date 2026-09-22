import type { AvatarConfig } from '../../types/relationTracker'
import {
  HAIR_COLORS,
  OUTFIT_COLORS,
  SKIN_TONES,
} from '../../types/relationTracker'
import {
  EYE_OPTIONS,
  HAIR_STYLE_OPTIONS,
  MOUTH_OPTIONS,
  OUTFIT_STYLE_OPTIONS,
} from '../../lib/avatarCustomizerOptions'
import { applyPreset, AVATAR_PRESETS } from '../../lib/avatarPresets'
import { MiiAvatar } from './MiiAvatar'

type Tab = 'Face' | 'Hair' | 'Outfit'

interface AvatarCustomizerProps {
  avatar: AvatarConfig
  tab: Tab
  onChange: (patch: Partial<AvatarConfig>) => void
}

export function AvatarCustomizer({ avatar, tab, onChange }: AvatarCustomizerProps) {
  const patch = (p: Partial<AvatarConfig>) =>
    onChange({ ...p, presetId: undefined })

  if (tab === 'Face') {
    return (
      <div className="space-y-4">
        <SwatchRow
          label="Skin tone"
          options={SKIN_TONES}
          value={avatar.skinTone}
          onChange={(i) => patch({ skinTone: i })}
        />
        <OptionGrid
          label="Eye shape"
          options={EYE_OPTIONS}
          value={avatar.eyeStyle}
          avatar={avatar}
          previewKey="eyeStyle"
          onChange={(i) => patch({ eyeStyle: i })}
        />
        <OptionGrid
          label="Mouth"
          options={MOUTH_OPTIONS}
          value={avatar.mouthStyle}
          avatar={avatar}
          previewKey="mouthStyle"
          onChange={(i) => patch({ mouthStyle: i })}
        />
        <QuickPresets onPick={(id) => onChange(applyPreset(id))} />
      </div>
    )
  }

  if (tab === 'Hair') {
    return (
      <div className="space-y-4">
        <OptionGrid
          label="Hairstyle"
          options={HAIR_STYLE_OPTIONS}
          value={avatar.hairStyle}
          avatar={avatar}
          previewKey="hairStyle"
          onChange={(i) => patch({ hairStyle: i })}
          cols={4}
        />
        <SwatchRow
          label="Hair color"
          options={HAIR_COLORS}
          value={avatar.hairColor}
          onChange={(i) => patch({ hairColor: i })}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SwatchRow
        label="Top color"
        options={OUTFIT_COLORS}
        value={avatar.outfitColor}
        onChange={(i) => patch({ outfitColor: i })}
      />
      <OptionGrid
        label="Top style"
        options={OUTFIT_STYLE_OPTIONS}
        value={avatar.outfitStyle}
        avatar={avatar}
        previewKey="outfitStyle"
        onChange={(i) => patch({ outfitStyle: i })}
        cols={2}
      />
    </div>
  )
}

function QuickPresets({ onPick }: { onPick: (id: string) => void }) {
  return (
    <div>
      <span className="mb-2 block text-[11px] text-muted">Quick starts</span>
      <div className="flex flex-wrap gap-2">
        {AVATAR_PRESETS.slice(0, 4).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p.id)}
            className="rounded-full border border-hairline bg-white px-2.5 py-1 text-[11px] text-[#48484A] hover:border-[#6B8F71]"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
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
            aria-label={`${label} ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

function OptionGrid({
  label,
  options,
  value,
  avatar,
  previewKey,
  onChange,
  cols = 5,
}: {
  label: string
  options: { id: number; label: string }[]
  value: number
  avatar: AvatarConfig
  previewKey: keyof AvatarConfig
  onChange: (i: number) => void
  cols?: number
}) {
  return (
    <div>
      <span className="mb-2 block text-[11px] text-muted">{label}</span>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`flex flex-col items-center rounded-xl bg-white/80 p-1 ring-2 transition ${
              value === opt.id
                ? 'ring-[#6B8F71]'
                : 'ring-transparent hover:ring-hairline'
            }`}
          >
            <MiiAvatar
              avatar={avatar}
              preview={{ [previewKey]: opt.id } as Partial<AvatarConfig>}
              size={44}
            />
            <span className="mt-0.5 w-full truncate text-center text-[9px] text-muted">
              {opt.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
