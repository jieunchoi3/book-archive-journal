import type { AvatarConfig } from '../types/relationTracker'
import { DEFAULT_AVATAR } from '../types/relationTracker'

export interface AvatarPreset {
  id: string
  label: string
  src: string
  config: AvatarConfig
  /** Which customizer tab shows this thumbnail */
  tabs: ('face' | 'hair' | 'outfit')[]
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'me',
    label: 'Classic',
    src: '/avatars/mii-me.png',
    tabs: ['face', 'hair', 'outfit'],
    config: {
      ...DEFAULT_AVATAR,
      presetId: 'me',
      skinTone: 2,
      hairStyle: 1,
      hairColor: 1,
      outfitColor: 0,
    },
  },
  {
    id: 'sophie',
    label: 'Pigtails',
    src: '/avatars/mii-sophie.png',
    tabs: ['face', 'hair', 'outfit'],
    config: {
      ...DEFAULT_AVATAR,
      presetId: 'sophie',
      skinTone: 1,
      hairStyle: 2,
      hairColor: 1,
      outfitColor: 3,
    },
  },
  {
    id: 'minji',
    label: 'Short bob',
    src: '/avatars/mii-minji.png',
    tabs: ['face', 'hair', 'outfit'],
    config: {
      ...DEFAULT_AVATAR,
      presetId: 'minji',
      skinTone: 2,
      hairStyle: 1,
      hairColor: 0,
      outfitColor: 1,
    },
  },
  {
    id: 'daniel',
    label: 'Bald & beard',
    src: '/avatars/mii-daniel.png',
    tabs: ['face', 'hair', 'outfit'],
    config: {
      ...DEFAULT_AVATAR,
      presetId: 'daniel',
      skinTone: 3,
      hairStyle: 0,
      hairColor: 0,
      eyeStyle: 2,
      mouthStyle: 2,
      outfitColor: 3,
      outfitStyle: 1,
    },
  },
  {
    id: 'ponytail',
    label: 'Ponytail',
    src: '/avatars/mii-hair-ponytail.png',
    tabs: ['hair', 'outfit'],
    config: {
      ...DEFAULT_AVATAR,
      presetId: 'ponytail',
      skinTone: 1,
      hairStyle: 3,
      hairColor: 4,
      outfitColor: 4,
    },
  },
  {
    id: 'blonde',
    label: 'Long blonde',
    src: '/avatars/mii-blonde.png',
    tabs: ['hair', 'outfit'],
    config: {
      ...DEFAULT_AVATAR,
      presetId: 'blonde',
      skinTone: 0,
      hairStyle: 3,
      hairColor: 3,
      outfitColor: 2,
    },
  },
  {
    id: 'beard',
    label: 'Brown beard',
    src: '/avatars/mii-beard.png',
    tabs: ['face', 'hair'],
    config: {
      ...DEFAULT_AVATAR,
      presetId: 'beard',
      skinTone: 2,
      hairStyle: 1,
      hairColor: 1,
      outfitColor: 1,
      outfitStyle: 1,
    },
  },
]

export function resolveAvatarSrc(config: AvatarConfig): string {
  if (config.presetId) {
    const hit = AVATAR_PRESETS.find((p) => p.id === config.presetId)
    if (hit) return hit.src
  }
  const scored = AVATAR_PRESETS.map((p) => ({
    p,
    score:
      (p.config.hairStyle === config.hairStyle ? 2 : 0) +
      (p.config.skinTone === config.skinTone ? 2 : 0) +
      (p.config.outfitColor === config.outfitColor ? 1 : 0),
  }))
  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.p.src ?? AVATAR_PRESETS[0].src
}

export function presetForTab(tab: 'face' | 'hair' | 'outfit'): AvatarPreset[] {
  return AVATAR_PRESETS.filter((p) => p.tabs.includes(tab))
}

export function applyPreset(presetId: string): AvatarConfig {
  const p = AVATAR_PRESETS.find((x) => x.id === presetId)
  return p ? { ...p.config } : { ...DEFAULT_AVATAR }
}
