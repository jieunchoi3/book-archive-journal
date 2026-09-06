import type { DiaryTagFolder } from '../types/diary'
import { isSupabaseConfigured, supabase } from './supabase'
import { normalizeDiaryTag } from './diaryTags'

const foldersKey = (userId: string) => `planner:diaryTagFolders:${userId}`

export function loadDiaryTagFoldersLocal(userId: string): DiaryTagFolder[] {
  try {
    const raw = localStorage.getItem(foldersKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as DiaryTagFolder[]
    return parsed
      .map((folder) => ({
        mainTag: normalizeDiaryTag(folder.mainTag),
        subTag: normalizeDiaryTag(folder.subTag),
      }))
      .filter((folder) => folder.mainTag)
  } catch {
    return []
  }
}

export function saveDiaryTagFoldersLocal(userId: string, folders: DiaryTagFolder[]): void {
  try {
    localStorage.setItem(foldersKey(userId), JSON.stringify(folders))
  } catch {
    // ignore quota / private mode
  }
}

export async function fetchDiaryTagFoldersCloud(userId: string): Promise<DiaryTagFolder[]> {
  const { data, error } = await supabase
    .from('diary_tag_folders')
    .select('main_tag, sub_tag')
    .eq('user_id', userId)
    .order('main_tag')
    .order('sub_tag')

  if (error) throw error
  return (data ?? []).map((row) => ({
    mainTag: normalizeDiaryTag(String(row.main_tag ?? '')),
    subTag: normalizeDiaryTag(String(row.sub_tag ?? '')),
  }))
}

export async function upsertDiaryTagFolderCloud(
  userId: string,
  folder: DiaryTagFolder,
): Promise<void> {
  const mainTag = normalizeDiaryTag(folder.mainTag)
  if (!mainTag) return
  const subTag = normalizeDiaryTag(folder.subTag)
  const { error } = await supabase.from('diary_tag_folders').upsert(
    {
      user_id: userId,
      main_tag: mainTag,
      sub_tag: subTag,
    },
    { onConflict: 'user_id,main_tag,sub_tag' },
  )
  if (error) throw error
}

export async function loadDiaryTagFolders(userId: string): Promise<DiaryTagFolder[]> {
  const local = loadDiaryTagFoldersLocal(userId)
  if (!isSupabaseConfigured) return local

  try {
    const cloud = await fetchDiaryTagFoldersCloud(userId)
    const merged = mergeDiaryTagFolders(local, cloud)
    saveDiaryTagFoldersLocal(userId, merged)
    for (const folder of local) {
      const exists = cloud.some(
        (item) => item.mainTag === folder.mainTag && item.subTag === folder.subTag,
      )
      if (!exists) {
        void upsertDiaryTagFolderCloud(userId, folder).catch(() => {})
      }
    }
    return merged
  } catch {
    return local
  }
}

export async function saveDiaryTagFolder(
  userId: string,
  folder: DiaryTagFolder,
): Promise<DiaryTagFolder[]> {
  const mainTag = normalizeDiaryTag(folder.mainTag)
  if (!mainTag) return loadDiaryTagFoldersLocal(userId)
  const normalized: DiaryTagFolder = {
    mainTag,
    subTag: normalizeDiaryTag(folder.subTag),
  }

  const existing = loadDiaryTagFoldersLocal(userId)
  const next = mergeDiaryTagFolders(existing, [normalized])
  saveDiaryTagFoldersLocal(userId, next)

  if (isSupabaseConfigured) {
    try {
      await upsertDiaryTagFolderCloud(userId, normalized)
    } catch {
      // local copy remains
    }
  }
  return next
}

function mergeDiaryTagFolders(a: DiaryTagFolder[], b: DiaryTagFolder[]): DiaryTagFolder[] {
  const map = new Map<string, DiaryTagFolder>()
  for (const folder of [...a, ...b]) {
    const mainTag = normalizeDiaryTag(folder.mainTag)
    if (!mainTag) continue
    const subTag = normalizeDiaryTag(folder.subTag)
    map.set(`${mainTag}\0${subTag}`, { mainTag, subTag })
  }
  return [...map.values()].sort((x, y) => {
    const main = x.mainTag.localeCompare(y.mainTag, 'ko')
    if (main !== 0) return main
    return x.subTag.localeCompare(y.subTag, 'ko')
  })
}
