import type { BlockCategory } from '../types/planner'

export interface CategoryStyle {
  label: string
  dot: string
  bg: string
  border: string
  text: string
}

export const CATEGORY_STYLES: Record<BlockCategory, CategoryStyle> = {
  morning: {
    label: 'Morning Routine',
    dot: '#E8A838',
    bg: '#FFF8EB',
    border: '#F5DFB8',
    text: '#8B6914',
  },
  work: {
    label: 'Work',
    dot: '#7B8FA1',
    bg: '#F0F3F6',
    border: '#D4DCE4',
    text: '#4A5A6A',
  },
  chore: {
    label: 'Chore',
    dot: '#D4845A',
    bg: '#FBF0EA',
    border: '#EDD0BE',
    text: '#8B5030',
  },
  meal: {
    label: 'Meal',
    dot: '#7BA882',
    bg: '#EFF5F0',
    border: '#C8DBC9',
    text: '#3D6B45',
  },
  growth: {
    label: 'Growth / Deep Work',
    dot: '#9B8EC4',
    bg: '#F3F0FA',
    border: '#D8D0ED',
    text: '#5C4D8A',
  },
  exercise: {
    label: 'Exercise',
    dot: '#E07A6F',
    bg: '#FDF0EE',
    border: '#F0C8C2',
    text: '#9E3D35',
  },
  free: {
    label: 'Free Time',
    dot: '#5BAFA8',
    bg: '#ECF7F6',
    border: '#B8DDD9',
    text: '#2D6B66',
  },
  night: {
    label: 'Night Routine',
    dot: '#5B6B8A',
    bg: '#EEF0F5',
    border: '#C4CAD8',
    text: '#3A4560',
  },
}

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_STYLES).map(([value, style]) => ({
  value: value as BlockCategory,
  label: style.label,
}))
