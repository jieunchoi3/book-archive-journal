import type { DiaryEntry, DiaryPhotoLayer, DiaryStroke } from '../types/diary'
import { isDiaryEntryEmpty } from '../types/diary'
import { supabase } from './supabase'

const BUCKET = 'diary-media'

type CloudLayer = {
  id: string
  x: number
  y: number
  scale: number
  strokes: DiaryStroke[]
  path: string
}

type DiaryRow = {
  user_id: string
  date_key: string
  title: string
  body: string
  frame_color: string
  canvas_strokes: DiaryStroke[]
  layers: CloudLayer[]
  cover_path: string | null
  updated_at: string
}

function layerPath(userId: string, dateKey: string, layerId: string) {
  return `${userId}/${dateKey}/layer-${layerId}.jpg`
}

function coverPath(userId: string, dateKey: string) {
  return `${userId}/${dateKey}/cover.jpg`
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'))
    reader.readAsDataURL(blob)
  })
}

async function uploadDataUrl(path: string, dataUrl: string): Promise<void> {
  const blob = await dataUrlToBlob(dataUrl)
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: blob.type || 'image/jpeg',
  })
  if (error) throw error
}

async function downloadDataUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error) throw error
  return blobToDataUrl(data)
}

async function removePaths(paths: string[]): Promise<void> {
  if (!paths.length) return
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) console.warn('[diary] storage remove failed', error)
}

async function hydrateLayers(layers: CloudLayer[]): Promise<DiaryPhotoLayer[]> {
  return Promise.all(
    layers.map(async (layer) => ({
      id: layer.id,
      x: layer.x,
      y: layer.y,
      scale: layer.scale,
      strokes: layer.strokes ?? [],
      src: await downloadDataUrl(layer.path),
    })),
  )
}

async function rowToEntry(row: DiaryRow, opts?: { hydrateLayers?: boolean }): Promise<DiaryEntry> {
  const dateKey =
    typeof row.date_key === 'string' ? row.date_key.slice(0, 10) : String(row.date_key)
  const layers = opts?.hydrateLayers === false
    ? (row.layers ?? []).map((layer) => ({
        id: layer.id,
        x: layer.x,
        y: layer.y,
        scale: layer.scale,
        strokes: layer.strokes ?? [],
        src: '',
      }))
    : await hydrateLayers(row.layers ?? [])

  let coverDataUrl: string | null = null
  if (row.cover_path) {
    try {
      coverDataUrl = await downloadDataUrl(row.cover_path)
    } catch (e) {
      console.warn('[diary] cover download failed', e)
    }
  }

  return {
    dateKey,
    title: row.title ?? '',
    body: row.body ?? '',
    layers,
    canvasStrokes: row.canvas_strokes ?? [],
    frameColor: row.frame_color,
    coverDataUrl,
    updatedAt: row.updated_at,
  }
}

export async function fetchDiaryEntriesForMonthCloud(
  userId: string,
  year: number,
  month: number,
): Promise<Record<string, DiaryEntry>> {
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const endDate = new Date(year, month + 1, 0)
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('date_key', start)
    .lte('date_key', end)

  if (error) throw error

  const out: Record<string, DiaryEntry> = {}
  for (const row of (data ?? []) as DiaryRow[]) {
    // Month grid only needs covers; hydrate layers lazily when opening a day.
    const entry = await rowToEntry(row, { hydrateLayers: false })
    if (entry.coverDataUrl || entry.title || entry.body || (entry.canvasStrokes?.length ?? 0) > 0) {
      out[entry.dateKey] = entry
    } else if ((row.layers ?? []).length > 0) {
      out[entry.dateKey] = entry
    }
  }
  return out
}

export async function fetchDiaryEntryCloud(
  userId: string,
  dateKey: string,
): Promise<DiaryEntry | null> {
  const { data, error } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('date_key', dateKey)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return rowToEntry(data as DiaryRow, { hydrateLayers: true })
}

export async function upsertDiaryEntryCloud(userId: string, entry: DiaryEntry): Promise<void> {
  if (isDiaryEntryEmpty(entry)) {
    await deleteDiaryEntryCloud(userId, entry.dateKey)
    return
  }

  const cloudLayers: CloudLayer[] = []
  for (const layer of entry.layers) {
    const path = layerPath(userId, entry.dateKey, layer.id)
    if (layer.src.startsWith('data:')) {
      await uploadDataUrl(path, layer.src)
    } else if (layer.src.startsWith('http')) {
      // Already a remote URL from a previous session — re-upload via fetch if needed.
      const blob = await (await fetch(layer.src)).blob()
      const dataUrl = await blobToDataUrl(blob)
      await uploadDataUrl(path, dataUrl)
    } else if (!layer.src) {
      // Placeholder from month list — keep existing storage object.
    } else {
      await uploadDataUrl(path, layer.src)
    }
    cloudLayers.push({
      id: layer.id,
      x: layer.x,
      y: layer.y,
      scale: layer.scale,
      strokes: layer.strokes ?? [],
      path,
    })
  }

  let cover: string | null = null
  if (entry.coverDataUrl?.startsWith('data:')) {
    cover = coverPath(userId, entry.dateKey)
    await uploadDataUrl(cover, entry.coverDataUrl)
  } else if (entry.coverDataUrl) {
    cover = coverPath(userId, entry.dateKey)
  } else if (entry.layers.length > 0 || (entry.canvasStrokes?.length ?? 0) > 0) {
    // Keep previous cover path if we somehow lost the data URL.
    cover = coverPath(userId, entry.dateKey)
  }

  // Drop storage for removed layers.
  const { data: existing } = await supabase
    .from('diary_entries')
    .select('layers')
    .eq('user_id', userId)
    .eq('date_key', entry.dateKey)
    .maybeSingle()
  const prevLayers = ((existing as { layers?: CloudLayer[] } | null)?.layers ?? []) as CloudLayer[]
  const nextIds = new Set(cloudLayers.map((l) => l.id))
  const orphanPaths = prevLayers.filter((l) => !nextIds.has(l.id)).map((l) => l.path)
  await removePaths(orphanPaths)

  const { error } = await supabase.from('diary_entries').upsert(
    {
      user_id: userId,
      date_key: entry.dateKey,
      title: entry.title,
      body: entry.body,
      frame_color: entry.frameColor,
      canvas_strokes: entry.canvasStrokes ?? [],
      layers: cloudLayers,
      cover_path: cover,
      updated_at: entry.updatedAt || new Date().toISOString(),
    },
    { onConflict: 'user_id,date_key' },
  )
  if (error) throw error
}

export async function deleteDiaryEntryCloud(userId: string, dateKey: string): Promise<void> {
  const { data: existing } = await supabase
    .from('diary_entries')
    .select('layers, cover_path')
    .eq('user_id', userId)
    .eq('date_key', dateKey)
    .maybeSingle()

  const row = existing as { layers?: CloudLayer[]; cover_path?: string | null } | null
  const paths = [
    ...(row?.layers ?? []).map((l) => l.path),
    ...(row?.cover_path ? [row.cover_path] : []),
  ]
  await removePaths(paths)

  const { error } = await supabase
    .from('diary_entries')
    .delete()
    .eq('user_id', userId)
    .eq('date_key', dateKey)
  if (error) throw error
}
