import { isSupabaseConfigured, supabase } from './supabase'

export type WishlistEnrichInput = {
  link?: string
  name?: string
  brand?: string
  store?: string
}

export type WishlistEnrichResult = {
  name?: string
  brand?: string
  store?: string
  estimatedPrice?: number | null
  currency?: string
  note?: string
}

export class WishlistEnrichError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WishlistEnrichError'
  }
}

function isValidHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function canEnrichWishlistFromLink(link: string): boolean {
  return isValidHttpUrl(link)
}

export function canEnrichWishlistFromNameBrand(name: string, brand: string): boolean {
  return Boolean(name.trim() && brand.trim())
}

function storeFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    const known: Record<string, string> = {
      'spacenk.com': 'Space NK',
      'refybeauty.com': 'Refy',
      'tkmaxx.com': 'TK Maxx',
      'oliveyoung.co.kr': 'Olive Young',
    }
    if (known[host]) return known[host]
    const base = host.split('.')[0] ?? host
    if (!base) return ''
    return base.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  } catch {
    return ''
  }
}

/** Best-effort parse when AI backends are unavailable. */
export function enrichWishlistFromLinkLocal(link: string): WishlistEnrichResult {
  try {
    const url = new URL(link.trim())
    const host = url.hostname.replace(/^www\./, '')
    const retailers: Record<string, string> = {
      'spacenk.com': 'Space NK',
      'tkmaxx.com': 'TK Maxx',
      'oliveyoung.co.kr': 'Olive Young',
    }
    const dtcBrands: Record<string, string> = {
      'refybeauty.com': 'Refy',
    }
    const store = retailers[host] ?? storeFromUrl(link)
    const brand = dtcBrands[host]
    const segments = url.pathname.split('/').filter(Boolean)
    const slug =
      [...segments]
        .reverse()
        .find((part) => part.length > 2 && !/^(uk|us|eu|products|product|p|shop)$/i.test(part)) ??
      ''
    const name = slug
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim()

    return {
      store,
      brand,
      name: name.length > 1 ? name : undefined,
      note: 'Basic parse from link — redeploy Supabase functions for full AI auto-fill.',
    }
  } catch {
    return {}
  }
}

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) {
    throw new WishlistEnrichError('Sign in required for AI auto-fill.')
  }
  return data.session.access_token
}

function isRetryableEnrichError(message: string): boolean {
  return (
    message.includes('GEMINI_API_KEY missing') ||
    message.includes('not configured on the server') ||
    message.includes('Failed to send a request to the Edge Function') ||
    message.includes('AI auto-fill service is unavailable') ||
    message.includes('Function not found') ||
    message.includes('404')
  )
}

function friendlyEnrichError(message: string, status?: number): WishlistEnrichError {
  if (message.includes('GEMINI_API_KEY missing')) {
    return new WishlistEnrichError('GEMINI_API_KEY missing on server')
  }
  if (status === 401 || message.includes('unauthorized')) {
    return new WishlistEnrichError('Sign in required for AI auto-fill.')
  }
  if (message.includes('Failed to send a request to the Edge Function')) {
    return new WishlistEnrichError('Failed to send a request to the Edge Function')
  }
  return new WishlistEnrichError(message || 'AI auto-fill failed.')
}

function parseEnrichPayload(data: unknown): WishlistEnrichResult {
  const payload = data as { result?: WishlistEnrichResult; error?: string } | null
  if (payload?.error) {
    throw friendlyEnrichError(String(payload.error))
  }
  if (!payload?.result) {
    throw new WishlistEnrichError('AI returned no data.')
  }
  return payload.result
}

async function invokeWishlistEnrichEdge(
  body: WishlistEnrichInput,
  functionName: 'wishlist-enrich' | 'compass-analyze',
): Promise<WishlistEnrichResult> {
  const payload =
    functionName === 'compass-analyze'
      ? { action: 'wishlist-enrich' as const, ...body }
      : body
  const { data, error } = await supabase.functions.invoke(functionName, { body: payload })
  if (error) {
    throw friendlyEnrichError(error.message)
  }
  return parseEnrichPayload(data)
}

async function invokeWishlistEnrichApi(
  token: string,
  body: WishlistEnrichInput,
): Promise<WishlistEnrichResult> {
  const response = await fetch('/api/wishlist-enrich', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  let payload: { result?: WishlistEnrichResult; error?: string } = {}
  try {
    payload = (await response.json()) as { result?: WishlistEnrichResult; error?: string }
  } catch {
    /* ignore */
  }

  if (!response.ok) {
    throw friendlyEnrichError(payload?.error ?? response.statusText, response.status)
  }
  if (payload?.error) {
    throw friendlyEnrichError(String(payload.error), response.status)
  }
  if (!payload?.result) {
    throw new WishlistEnrichError('AI returned no data.')
  }
  return payload.result
}

export async function enrichWishlistItem(
  input: WishlistEnrichInput,
): Promise<WishlistEnrichResult> {
  if (!isSupabaseConfigured) {
    throw new WishlistEnrichError('Connect Supabase to use AI auto-fill.')
  }

  const link = input.link?.trim()
  const name = input.name?.trim()
  const brand = input.brand?.trim()
  const store = input.store?.trim()

  if (link && !canEnrichWishlistFromLink(link)) {
    throw new WishlistEnrichError('Enter a valid http(s) link.')
  }
  if (!link && !(name && brand)) {
    throw new WishlistEnrichError('Add a link, or both name and brand.')
  }

  const body = {
    link: link || undefined,
    name: name || undefined,
    brand: brand || undefined,
    store: store || undefined,
  }

  const token = await getAccessToken()
  const attempts: Array<() => Promise<WishlistEnrichResult>> = [
    () => invokeWishlistEnrichEdge(body, 'wishlist-enrich'),
    () => invokeWishlistEnrichEdge(body, 'compass-analyze'),
    () => invokeWishlistEnrichApi(token, body),
  ]

  let lastError: WishlistEnrichError | null = null
  for (const attempt of attempts) {
    try {
      return await attempt()
    } catch (e) {
      const err =
        e instanceof WishlistEnrichError
          ? e
          : new WishlistEnrichError(e instanceof Error ? e.message : 'AI auto-fill failed.')
      if (!isRetryableEnrichError(err.message)) {
        throw err
      }
      lastError = err
    }
  }

  if (link) {
    const local = enrichWishlistFromLinkLocal(link)
    if (local.store || local.name || local.brand) {
      return local
    }
  }

  throw (
    lastError ??
    new WishlistEnrichError(
      'AI auto-fill is not configured on the server yet. Add GEMINI_API_KEY to Vercel or deploy Supabase functions.',
    )
  )
}
