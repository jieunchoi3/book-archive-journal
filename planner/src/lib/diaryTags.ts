import type { DiaryEntry, DiaryTagFilter, DiaryTagFolder, DiaryTagTreeNode } from '../types/diary'
import { diaryEntryHasPhoto, isDiaryEntryEmpty } from '../types/diary'

export function normalizeDiaryTag(value: string): string {
  return value.trim().replace(/^#+/, '')
}

export function formatDiaryTagLabel(value: string): string {
  const normalized = normalizeDiaryTag(value)
  return normalized ? `#${normalized}` : ''
}

export function entryHasDiaryContent(entry: DiaryEntry): boolean {
  return !isDiaryEntryEmpty(entry) || diaryEntryHasPhoto(entry)
}

export function entryMatchesTagFilter(entry: DiaryEntry, filter: DiaryTagFilter): boolean {
  if (filter.type === 'all') return true
  if (!entry.mainTag) return false
  if (normalizeDiaryTag(entry.mainTag) !== normalizeDiaryTag(filter.mainTag)) return false
  if (filter.type === 'main') return true
  return normalizeDiaryTag(entry.subTag ?? '') === normalizeDiaryTag(filter.subTag)
}

export function buildDiaryTagTree(
  entries: Record<string, DiaryEntry>,
  savedFolders: DiaryTagFolder[],
): DiaryTagTreeNode[] {
  const mains = new Map<
    string,
    { entryCount: number; subs: Map<string, number> }
  >()

  const ensureMain = (raw: string) => {
    const mainTag = normalizeDiaryTag(raw)
    if (!mainTag) return null
    if (!mains.has(mainTag)) {
      mains.set(mainTag, { entryCount: 0, subs: new Map() })
    }
    return mains.get(mainTag)!
  }

  for (const folder of savedFolders) {
    const main = ensureMain(folder.mainTag)
    if (!main) continue
    const sub = normalizeDiaryTag(folder.subTag)
    if (sub && !main.subs.has(sub)) main.subs.set(sub, 0)
  }

  for (const entry of Object.values(entries)) {
    if (!entryHasDiaryContent(entry) || !entry.mainTag) continue
    const main = ensureMain(entry.mainTag)
    if (!main) continue
    main.entryCount += 1
    const sub = normalizeDiaryTag(entry.subTag ?? '')
    if (sub) {
      main.subs.set(sub, (main.subs.get(sub) ?? 0) + 1)
    }
  }

  return [...mains.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'ko'))
    .map(([mainTag, data]) => ({
      mainTag,
      entryCount: data.entryCount,
      subTags: [...data.subs.entries()]
        .sort(([a], [b]) => a.localeCompare(b, 'ko'))
        .map(([name, count]) => ({ name, count })),
    }))
}

export function listMainTags(tree: DiaryTagTreeNode[]): string[] {
  return tree.map((node) => node.mainTag)
}

export function listSubTags(tree: DiaryTagTreeNode[], mainTag: string): string[] {
  const node = tree.find((item) => item.mainTag === normalizeDiaryTag(mainTag))
  return node?.subTags.map((sub) => sub.name) ?? []
}

export function filterLabel(filter: DiaryTagFilter): string {
  if (filter.type === 'all') return 'All notes'
  if (filter.type === 'main') return `#${filter.mainTag}`
  return `#${filter.mainTag} / #${filter.subTag}`
}
