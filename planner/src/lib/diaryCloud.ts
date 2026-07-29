import type { DiaryEntry, DiaryPhotoLayer, DiaryStroke } from '../types/diary'
import { isDiaryEntryEmpty } from '../types/diary'
import { supabase } from './supabase'

const BUCKET = 'diary-media'
const SIGNED_URL_TTL_SEC = 60 * 60 * 6

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
  date_key: string | Date
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

/** Normalize PostgREST date / Date values to YYYY-MM-DD. */
export function normalizeDateKey(value: string | Date): string {
  if (value instanceof Date) {
    const y = value.getUTCFullYear()
    const m = String(value.getUTCMonth() + 1).padStart(2, '0')
    const d = String(value.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const raw = String(value)
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return normalizeDateKey(parsed)
  }
  return raw.slice(0, 10)
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
    cacheControl: '3600',
  })
  if (error) throw error
}

async function downloadDataUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error) throw error
  return blobToDataUrl(data)
}

async function signedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SEC)
  if (error) {
    console.warn('[diary] signed URL failed', path, error.message)
    return null
  }
  return data.signedUrl
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

async function rowToEntry(
  row: DiaryRow,
  opts?: { hydrateLayers?: boolean; coverMode?: 'signed' | 'download' },
): Promise<DiaryEntry> {
  const dateKey = normalizeDateKey(row.date_key)
  const cloudLayers = Array.isArray(row.layers) ? row.layers : []
  const coverMode = opts?.coverMode ?? 'signed'

  const layers =
    opts?.hydrateLayers === false
      ? cloudLayers.map((layer) => ({
          id: layer.id,
          x: layer.x,
          y: layer.y,
          scale: layer.scale,
          strokes: layer.strokes ?? [],
          src: '',
        }))
      : await hydrateLayers(cloudLayers)

  let coverDataUrl: string | null = null
  if (row.cover_path) {
    try {
      coverDataUrl =
        coverMode === 'download'
          ? await downloadDataUrl(row.cover_path)
          : await signedUrl(row.cover_path)
    } catch (e) {
      console.warn('[diary] cover resolve failed', row.cover_path, e)
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
  const endDate = new Date(Date.UTC(year, month + 1, 0))
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDate.getUTCDate()).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('date_key', start)
    .lte('date_key', end)

  if (error) throw error

  const out: Record<string, DiaryEntry> = {}
  await Promise.all(
    ((data ?? []) as DiaryRow[]).map(async (row) => {
      const entry = await rowToEntry(row, {
        hydrateLayers: false,
        coverMode: 'signed',
      })
      const hasLayers = (row.layers ?? []).length > 0
      if (
        entry.coverDataUrl ||
        entry.title ||
        entry.body ||
        (entry.canvasStrokes?.length ?? 0) > 0 ||
        hasLayers
      ) {
        out[entry.dateKey] = entry
      }
    }),
  )
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
  return rowToEntry(data as DiaryRow, {
    hydrateLayers: true,
    coverMode: 'download',
  })
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
      const blob = await (await fetch(layer.src)).blob()
      const dataUrl = await blobToDataUrl(blob)
      await uploadDataUrl(path, dataUrl)
    } else if (!layer.src) {
      // Keep existing storage object for placeholder layers from month list.
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
  } else if (entry.layers.length > 0 || (entry.canvasStrokes?.length ?? 0) > 0) {
    cover = coverPath(userId, entry.dateKey)
    // If we only have a signed/http cover URL, re-upload so Storage stays fresh.
    if (entry.coverDataUrl?.startsWith('http')) {
      try {
        const blob = await (await fetch(entry.coverDataUrl)).blob()
        const dataUrl = await blobToDataUrl(blob)
        await uploadDataUrl(cover, dataUrl)
      } catch {
        // Keep previous cover object if re-fetch fails.
      }
    }
  }

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
