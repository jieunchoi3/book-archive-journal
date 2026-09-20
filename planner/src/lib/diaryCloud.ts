import type {
  DiaryBodyImage,
  DiaryEntry,
  DiaryPhotoLayer,
  DiaryStroke,
  DiaryTagFolder,
} from '../types/diary'
import { diaryEntryHasPhoto, isDiaryEntryEmpty } from '../types/diary'
import { applyTagFoldersToEntry, getEntryTagFolders, normalizeTagFolders } from './diaryTags'
import { supabase } from './supabase'

const BUCKET = 'diary-media'
const SIGNED_URL_TTL_SEC = 60 * 60 * 24

type CloudLayer = {
  id: string
  x: number
  y: number
  scale: number
  strokes: DiaryStroke[]
  path: string
}

type CloudBodyImage = {
  id: string
  path: string
}

type DiaryRow = {
  user_id: string
  entry_id: string
  date_key: string | Date
  title: string
  body: string
  body_images: CloudBodyImage[]
  main_tag: string | null
  sub_tag: string | null
  tag_folders?: DiaryTagFolder[] | null
  frame_color: string
  canvas_strokes: DiaryStroke[]
  layers: CloudLayer[]
  cover_path: string | null
  updated_at: string
}

function mediaDir(userId: string, entryId: string) {
  return `${userId}/${entryId}`
}

function layerPath(userId: string, entryId: string, layerId: string) {
  return `${mediaDir(userId, entryId)}/layer-${layerId}.jpg`
}

function bodyImagePath(userId: string, entryId: string, imageId: string) {
  return `${mediaDir(userId, entryId)}/body-${imageId}.jpg`
}

function coverPath(userId: string, entryId: string) {
  return `${mediaDir(userId, entryId)}/cover.jpg`
}

function thumbPath(userId: string, entryId: string) {
  return `${mediaDir(userId, entryId)}/thumb.jpg`
}

/** Legacy rows store media under date_key; keep using that folder when paths already exist. */
function legacyMediaDir(userId: string, dateKey: string) {
  return `${userId}/${dateKey}`
}

/** Derive thumb.jpg path next to an existing cover.jpg path. */
function thumbPathFromCover(cover: string): string {
  return cover.replace(/cover\.jpg$/i, 'thumb.jpg')
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
    // Thumbs/covers are immutable per day revision; allow long browser cache.
    cacheControl: '86400',
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

/** Batch-sign storage paths; missing objects are omitted from the map. */
async function signedUrls(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))]
  const out = new Map<string, string>()
  if (!unique.length) return out

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SEC)

  if (error) {
    console.warn('[diary] batch signed URLs failed', error.message)
    // Fall back to sequential so a batch API issue doesn't blank the month.
    await Promise.all(
      unique.map(async (path) => {
        const url = await signedUrl(path)
        if (url) out.set(path, url)
      }),
    )
    return out
  }

  for (const item of data ?? []) {
    if (item.signedUrl && item.path) out.set(item.path, item.signedUrl)
  }
  return out
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

async function hydrateBodyImages(images: CloudBodyImage[]): Promise<DiaryBodyImage[]> {
  return Promise.all(
    images.map(async (image) => ({
      id: image.id,
      src: await downloadDataUrl(image.path),
    })),
  )
}

function bodyImagesFromRow(
  images: CloudBodyImage[],
  opts?: { signedUrlMap?: Map<string, string> },
): DiaryBodyImage[] {
  return images.map((image) => ({
    id: image.id,
    src: opts?.signedUrlMap?.get(image.path) ?? '',
  }))
}

async function rowToEntry(
  row: DiaryRow,
  opts?: {
    hydrateLayers?: boolean
    coverMode?: 'signed' | 'download'
    signedUrlMap?: Map<string, string>
  },
): Promise<DiaryEntry> {
  const dateKey = normalizeDateKey(row.date_key)
  const cloudLayers = Array.isArray(row.layers) ? row.layers : []
  const cloudBodyImages = Array.isArray(row.body_images) ? row.body_images : []
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

  const bodyImages =
    opts?.hydrateLayers === false
      ? bodyImagesFromRow(cloudBodyImages, { signedUrlMap: opts?.signedUrlMap })
      : await hydrateBodyImages(cloudBodyImages)

  let coverDataUrl: string | null = null
  let thumbDataUrl: string | null = null

  if (row.cover_path) {
    const thumb = thumbPathFromCover(row.cover_path)
    try {
      if (coverMode === 'download') {
        coverDataUrl = await downloadDataUrl(row.cover_path)
        try {
          thumbDataUrl = await downloadDataUrl(thumb)
        } catch {
          thumbDataUrl = null
        }
      } else if (opts?.signedUrlMap) {
        thumbDataUrl = opts.signedUrlMap.get(thumb) ?? null
        coverDataUrl = opts.signedUrlMap.get(row.cover_path) ?? null
        // Grid only needs a thumb; if missing, fall back to full cover URL.
        if (!thumbDataUrl && coverDataUrl) thumbDataUrl = coverDataUrl
      } else {
        thumbDataUrl = (await signedUrl(thumb)) ?? (await signedUrl(row.cover_path))
        coverDataUrl = await signedUrl(row.cover_path)
      }
    } catch (e) {
      console.warn('[diary] cover resolve failed', row.cover_path, e)
    }
  }

  const tagFoldersFromRow = normalizeTagFolders(
    (row.tag_folders ?? []).map((folder) => {
      const rec = folder as DiaryTagFolder & { main_tag?: string; sub_tag?: string }
      return {
        mainTag: String(rec.mainTag ?? rec.main_tag ?? ''),
        subTag: String(rec.subTag ?? rec.sub_tag ?? ''),
      }
    }),
  )
  const legacyTags =
    tagFoldersFromRow.length === 0 && row.main_tag?.trim()
      ? [
          {
            mainTag: row.main_tag.trim(),
            subTag: row.sub_tag?.trim() ?? '',
          },
        ]
      : tagFoldersFromRow
  const tagPatch = applyTagFoldersToEntry(legacyTags)

  return {
    id: row.entry_id,
    dateKey,
    title: row.title ?? '',
    body: row.body ?? '',
    tagFolders: tagPatch.tagFolders,
    mainTag: tagPatch.mainTag,
    subTag: tagPatch.subTag,
    bodyImages,
    layers,
    canvasStrokes: row.canvas_strokes ?? [],
    frameColor: row.frame_color,
    coverDataUrl,
    thumbDataUrl,
    updatedAt: row.updated_at,
  }
}

export async function fetchDiaryEntriesForMonthCloud(
  userId: string,
  year: number,
  month: number,
): Promise<Record<string, DiaryEntry[]>> {
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

  const rows = (data ?? []) as DiaryRow[]
  const paths: string[] = []
  for (const row of rows) {
    if (row.cover_path) {
      paths.push(thumbPathFromCover(row.cover_path))
      paths.push(row.cover_path)
    }
    for (const image of row.body_images ?? []) {
      if (image.path) paths.push(image.path)
    }
  }
  const urlMap = await signedUrls(paths)

  const out: Record<string, DiaryEntry[]> = {}
  await Promise.all(
    rows.map(async (row) => {
      const entry = await rowToEntry(row, {
        hydrateLayers: false,
        coverMode: 'signed',
        signedUrlMap: urlMap,
      })
      const hasLayers = (row.layers ?? []).length > 0
      const hasBodyImages = (row.body_images ?? []).length > 0
      if (
        entry.thumbDataUrl ||
        entry.coverDataUrl ||
        entry.title ||
        entry.body ||
        (entry.bodyImages?.length ?? 0) > 0 ||
        (entry.canvasStrokes?.length ?? 0) > 0 ||
        hasLayers ||
        hasBodyImages
      ) {
        const list = out[entry.dateKey] ?? []
        list.push(entry)
        out[entry.dateKey] = list
      }
    }),
  )
  for (const key of Object.keys(out)) {
    out[key].sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0))
  }
  return out
}

export async function fetchDiaryEntryCloud(
  userId: string,
  entryId: string,
): Promise<DiaryEntry | null> {
  const { data, error } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('entry_id', entryId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return rowToEntry(data as DiaryRow, {
    hydrateLayers: true,
    coverMode: 'download',
  })
}

type ExistingDiaryRow = {
  layers?: CloudLayer[]
  body_images?: CloudBodyImage[]
  cover_path?: string | null
}

function cloudRowHasStoredMedia(row: ExistingDiaryRow | null | undefined): boolean {
  if (!row) return false
  if (row.cover_path) return true
  return (row.layers?.length ?? 0) > 0 || (row.body_images?.length ?? 0) > 0
}

/** Cloud deletes only via explicit deleteDiaryEntry — never from an “empty-looking” autosave. */
export async function upsertDiaryEntryCloud(userId: string, entry: DiaryEntry): Promise<void> {
  const { data: existingRow } = await supabase
    .from('diary_entries')
    .select('layers, body_images, cover_path')
    .eq('user_id', userId)
    .eq('entry_id', entry.id)
    .maybeSingle()
  const prevRow = existingRow as ExistingDiaryRow | null

  if (isDiaryEntryEmpty(entry) && !diaryEntryHasPhoto(entry)) {
    if (cloudRowHasStoredMedia(prevRow)) {
      console.warn('[diary] skipped cloud upsert: local entry looks empty but cloud still has media', entry.dateKey)
      return
    }
    return
  }

  const prevLayers = prevRow?.layers ?? []
  const prevBodyImages = prevRow?.body_images ?? []
  const prevLayerById = new Map(prevLayers.map((l) => [l.id, l]))
  const prevBodyById = new Map(prevBodyImages.map((i) => [i.id, i]))
  const usesLegacyDir =
    Boolean(prevRow?.cover_path?.includes(`/${entry.dateKey}/`)) ||
    prevLayers.some((l) => l.path?.includes(`/${entry.dateKey}/`))
  const storageKey = usesLegacyDir ? entry.dateKey : entry.id

  const cloudLayers: CloudLayer[] = []
  for (const layer of entry.layers) {
    const path =
      prevLayerById.get(layer.id)?.path ?? layerPath(userId, storageKey, layer.id)
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

  const cloudBodyImages: CloudBodyImage[] = []
  for (const image of entry.bodyImages ?? []) {
    const path =
      prevBodyById.get(image.id)?.path ?? bodyImagePath(userId, storageKey, image.id)
    if (image.src.startsWith('data:')) {
      await uploadDataUrl(path, image.src)
    } else if (image.src.startsWith('http')) {
      try {
        const blob = await (await fetch(image.src)).blob()
        const dataUrl = await blobToDataUrl(blob)
        await uploadDataUrl(path, dataUrl)
      } catch {
        // Keep existing storage object if re-fetch fails.
      }
    } else if (!image.src) {
      // Keep existing storage object for placeholder images from month list.
    } else {
      await uploadDataUrl(path, image.src)
    }
    cloudBodyImages.push({ id: image.id, path })
  }

  let cover: string | null = prevRow?.cover_path ?? null
  const thumb = cover
    ? thumbPathFromCover(cover)
    : thumbPath(userId, storageKey)

  if (entry.coverDataUrl?.startsWith('data:')) {
    cover = cover ?? coverPath(userId, storageKey)
    await uploadDataUrl(cover, entry.coverDataUrl)
  } else if (entry.layers.length > 0 || (entry.canvasStrokes?.length ?? 0) > 0) {
    cover = cover ?? coverPath(userId, storageKey)
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

  if (entry.thumbDataUrl?.startsWith('data:')) {
    await uploadDataUrl(thumb, entry.thumbDataUrl)
  } else if (entry.coverDataUrl?.startsWith('data:')) {
    // Older clients: derive thumb from the full cover before upload finishes elsewhere.
    // Cover data URL is already small enough to re-encode client-side in useDiary.
  }

  const nextLayerIds = new Set(cloudLayers.map((l) => l.id))
  const nextBodyImageIds = new Set(cloudBodyImages.map((i) => i.id))
  const orphanPaths = [
    ...prevLayers.filter((l) => !nextLayerIds.has(l.id)).map((l) => l.path),
    ...prevBodyImages.filter((i) => !nextBodyImageIds.has(i.id)).map((i) => i.path),
  ]
  await removePaths(orphanPaths)

  const tagFolders = getEntryTagFolders(entry)
  const tagPatch = applyTagFoldersToEntry(tagFolders)

  const { error } = await supabase.from('diary_entries').upsert(
    {
      user_id: userId,
      entry_id: entry.id,
      date_key: entry.dateKey,
      title: entry.title,
      body: entry.body,
      main_tag: tagPatch.mainTag?.trim() || null,
      sub_tag: tagPatch.subTag?.trim() || null,
      tag_folders: tagPatch.tagFolders,
      body_images: cloudBodyImages,
      frame_color: entry.frameColor,
      canvas_strokes: entry.canvasStrokes ?? [],
      layers: cloudLayers,
      cover_path: cover,
      updated_at: entry.updatedAt || new Date().toISOString(),
    },
    { onConflict: 'user_id,entry_id' },
  )
  if (error) throw error
}

export async function deleteDiaryEntryCloud(userId: string, entryId: string): Promise<void> {
  const { data: existing } = await supabase
    .from('diary_entries')
    .select('layers, cover_path, body_images, date_key')
    .eq('user_id', userId)
    .eq('entry_id', entryId)
    .maybeSingle()

  const row = existing as {
    layers?: CloudLayer[]
    cover_path?: string | null
    body_images?: CloudBodyImage[]
    date_key?: string
  } | null
  const dateKey = row?.date_key ? normalizeDateKey(row.date_key) : entryId
  const paths = [
    ...(row?.layers ?? []).map((l) => l.path),
    ...(row?.body_images ?? []).map((i) => i.path),
    ...(row?.cover_path ? [row.cover_path, thumbPathFromCover(row.cover_path)] : []),
    thumbPath(userId, entryId),
    `${legacyMediaDir(userId, dateKey)}/thumb.jpg`,
  ]
  await removePaths(paths)

  const { error } = await supabase
    .from('diary_entries')
    .delete()
    .eq('user_id', userId)
    .eq('entry_id', entryId)
  if (error) throw error
}
