export type LinkedAppOpenMode = 'iframe' | 'newTab'

export interface LinkedApp {
  id: string
  name: string
  url: string
  icon?: string
  openMode: LinkedAppOpenMode
}

export const DEFAULT_LINKED_APPS: LinkedApp[] = [
  {
    id: 'content-planner',
    name: 'Content Planner',
    url: 'https://content-flux-hub.base44.app/planner',
    icon: '📋',
    openMode: 'newTab',
  },
  {
    id: 'reading-archive',
    name: 'Reading Archive',
    url: 'https://book-archive-journal.vercel.app',
    icon: '📚',
    openMode: 'iframe',
  },
]
