import type { DiaryEntry, DiaryTagFilter, DiaryTagFolder, DiaryTagTreeNode } from '../types/diary'
import { diaryEntryHasPhoto, isDiaryEntryEmpty } from '../types/diary'

export function normalizeDiaryTag(value: string): string {
  return value.trim().replace(/^#+/, '')
}

export function normalizeTagFolder(folder: DiaryTagFolder): DiaryTagFolder | null {
  const mainTag = normalizeDiaryTag(folder.mainTag)
  if (!mainTag) return null
  const subTag = normalizeDiaryTag(folder.subTag)
  return { mainTag, subTag }
}

export function normalizeTagFolders(folders: DiaryTagFolder[]): DiaryTagFolder[] {
  const seen = new Set<string>()
  const out: DiaryTagFolder[] = []
  for (const folder of folders) {
    const normalized = normalizeTagFolder(folder)
    if (!normalized) continue
    const key = `${normalized.mainTag}\0${normalized.subTag}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
  }
  return out
}

/** Effective tag rows for an entry (migrates legacy main/sub-only entries). */
export function getEntryTagFolders(entry: DiaryEntry): DiaryTagFolder[] {
  const fromList = normalizeTagFolders(entry.tagFolders ?? [])
  if (fromList.length) return fromList
  const mainTag = normalizeDiaryTag(entry.mainTag ?? '')
  if (!mainTag) return []
  return [{ mainTag, subTag: normalizeDiaryTag(entry.subTag ?? '') }]
}

export function tagFolderMatchesFilter(
  folder: DiaryTagFolder,
  filter: DiaryTagFilter,
): boolean {
  if (filter.type === 'all') return true
  if (normalizeDiaryTag(folder.mainTag) !== normalizeDiaryTag(filter.mainTag)) return false
  if (filter.type === 'main') return true
  return normalizeDiaryTag(folder.subTag) === normalizeDiaryTag(filter.subTag)
}

export function applyTagFoldersToEntry(
  folders: DiaryTagFolder[],
): Pick<DiaryEntry, 'tagFolders' | 'mainTag' | 'subTag'> {
  const tagFolders = normalizeTagFolders(folders)
  const first = tagFolders[0]
  return {
    tagFolders,
    mainTag: first?.mainTag ?? null,
    subTag: first?.subTag ? first.subTag : null,
  }
}

export function removeTagFolderFromEntry(
  entry: DiaryEntry,
  mainTag: string,
  subTag?: string,
): DiaryTagFolder[] {
  const main = normalizeDiaryTag(mainTag)
  const sub = subTag !== undefined ? normalizeDiaryTag(subTag) : undefined
  return getEntryTagFolders(entry).filter((folder) => {
    if (normalizeDiaryTag(folder.mainTag) !== main) return true
    if (sub !== undefined) return normalizeDiaryTag(folder.subTag) !== sub
    return false
  })
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
  const folders = getEntryTagFolders(entry)
  if (!folders.length) return false
  return folders.some((folder) => tagFolderMatchesFilter(folder, filter))
}

export function buildDiaryTagTree(
  entries: DiaryEntry[] | Record<string, DiaryEntry | DiaryEntry[]>,
  savedFolders: DiaryTagFolder[],
): DiaryTagTreeNode[] {
  const entryList: DiaryEntry[] = Array.isArray(entries)
    ? entries
    : Object.values(entries).flatMap((value) => (Array.isArray(value) ? value : [value]))
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

  for (const entry of entryList) {
    if (!entryHasDiaryContent(entry)) continue
    const folders = getEntryTagFolders(entry)
    if (!folders.length) continue
    const countedMains = new Set<string>()
    for (const folder of folders) {
      const main = ensureMain(folder.mainTag)
      if (!main) continue
      if (!countedMains.has(folder.mainTag)) {
        main.entryCount += 1
        countedMains.add(folder.mainTag)
      }
      const sub = normalizeDiaryTag(folder.subTag)
      if (sub) {
        main.subs.set(sub, (main.subs.get(sub) ?? 0) + 1)
      }
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
