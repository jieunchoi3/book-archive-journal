import type { DiaryTagFolder } from '../types/diary'
import { supabase } from './supabase'
import { normalizeDiaryTag } from './diaryTags'

const TABLE = 'diary_v2_tag_folders'

export async function loadDiaryV2TagFolders(userId: string): Promise<DiaryTagFolder[]> {
  const { data, error } = await supabase
    .from(TABLE)
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

export async function saveDiaryV2TagFolder(
  userId: string,
  folder: DiaryTagFolder,
): Promise<DiaryTagFolder[]> {
  const mainTag = normalizeDiaryTag(folder.mainTag)
  if (!mainTag) return loadDiaryV2TagFolders(userId)
  const subTag = normalizeDiaryTag(folder.subTag)
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      main_tag: mainTag,
      sub_tag: subTag,
    },
    { onConflict: 'user_id,main_tag,sub_tag' },
  )
  if (error) throw error
  return loadDiaryV2TagFolders(userId)
}

export async function deleteDiaryV2TagFolder(
  userId: string,
  mainTag: string,
  subTag?: string,
): Promise<DiaryTagFolder[]> {
  const main = normalizeDiaryTag(mainTag)
  let query = supabase.from(TABLE).delete().eq('user_id', userId).eq('main_tag', main)
  if (subTag !== undefined) {
    query = query.eq('sub_tag', normalizeDiaryTag(subTag))
  }
  const { error } = await query
  if (error) throw error
  return loadDiaryV2TagFolders(userId)
}
